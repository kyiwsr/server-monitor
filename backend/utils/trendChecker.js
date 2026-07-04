/**
 * Predictive (Trend-Based) Alert Scheduler
 * ========================================
 *
 * The threshold-alert path in routes/metrics.js is reactive: it only fires once
 * a metric has *already* crossed its critical line. This scheduler adds the
 * proactive half — it looks at each server's recent metric history, fits a
 * simple linear trend, and if a metric is climbing toward its critical
 * threshold it raises a `Warning`-severity, `predictive: true` alert with an
 * estimated time-to-breach *before* the outage happens.
 *
 * On each tick, for every server:
 *   - Pull the last TREND_LOOKBACK_MINUTES of metrics (need >= TREND_MIN_SAMPLES).
 *   - For cpu/ram/disk independently, least-squares fit value vs. time -> slope.
 *   - If rising and projected to hit `<metric>Crit` within PREDICTION_WINDOW_HOURS
 *     (and not already Critical), create a predictive alert (deduped per server+type).
 *   - If a previously-raised predictive alert no longer projects a breach, or a
 *     real threshold alert now owns that metric, auto-resolve the predictive one.
 *
 * Structure mirrors downChecker.js (runGuarded/isRunning/RUN_TIMEOUT_MS,
 * start/stop, an exported single-pass `checkTrendsOnce` for testability, and an
 * exported pure `computeTrend` for the regression math).
 */

const Server = require('../models/Server');
const Metric = require('../models/Metric');
const Alert = require('../models/Alert');
const User = require('../models/User');
const { sendAlertEmail } = require('./emailService');

// Proactive, forward-looking recommendations for predictive alerts. Distinct
// wording from the reactive RECOMMENDED_ACTIONS in routes/metrics.js — these
// tell the user to act *before* the projected breach, not after.
const PREDICTIVE_ACTIONS = {
  cpu: {
    summary:
      'CPU load is trending upward. Investigate the growth before it saturates the server.',
    steps: [
      'Review which processes are consuming increasing CPU (e.g. `top` / `htop`).',
      'Check for a runaway job, traffic spike, or a stuck background task.',
      'Plan to scale CPU or redistribute the workload before the projected date.',
    ],
  },
  ram: {
    summary:
      'Memory usage is trending upward. Address it before the server runs out of RAM.',
    steps: [
      'Identify the process whose memory is steadily growing (possible leak).',
      'Restart or patch the offending application if a leak is confirmed.',
      'Plan to add RAM or enable swap before the projected date.',
    ],
  },
  disk: {
    summary:
      'Disk usage is trending upward. Plan disk cleanup or expansion before the projected date to avoid an outage.',
    steps: [
      'Run `df -h` and `du -sh /*` to find what is growing.',
      'Clear old logs (/var/log), caches, or temporary files.',
      'Schedule log rotation or expand/attach storage before the projected date.',
    ],
  },
};

let intervalHandle = null;
let isRunning = false;

// Safety net: bounds how long the isRunning flag can stay stuck if a pass never
// settles, so the scheduler can't wedge permanently.
const RUN_TIMEOUT_MS = 4 * 60 * 1000;

/**
 * Least-squares linear regression of a metric over time.
 *
 * Pure and side-effect free so it can be unit-tested in isolation.
 *
 * @param {Array<{timestamp: Date|number|string, value: number}>} samples
 *        Readings ordered by time ascending. `timestamp` may be a Date, an
 *        epoch-ms number, or an ISO string.
 * @param {number} threshold The critical threshold to project toward.
 * @returns {{slope: number, currentValue: number, etaSeconds: number}|null}
 *          `slope` is in units-per-second. `etaSeconds` is the projected seconds
 *          until `currentValue` reaches `threshold` at the current rate, or
 *          `Infinity` when the metric is flat/falling (no breach predicted).
 *          Returns `null` when there are too few points to fit a line (< 2).
 */
function computeTrend(samples, threshold) {
  if (!Array.isArray(samples) || samples.length < 2) return null;

  const toMs = (t) => (t instanceof Date ? t.getTime() : new Date(t).getTime());
  const t0 = toMs(samples[0].timestamp);

  // x = seconds since first sample, y = metric value
  const points = samples.map((s) => ({
    x: (toMs(s.timestamp) - t0) / 1000,
    y: Number(s.value),
  }));

  const n = points.length;
  const sumX = points.reduce((a, p) => a + p.x, 0);
  const sumY = points.reduce((a, p) => a + p.y, 0);
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
  const sumXX = points.reduce((a, p) => a + p.x * p.x, 0);

  const denom = n * sumXX - sumX * sumX;
  // Degenerate: all samples share the same timestamp — can't fit a slope.
  if (denom === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denom;
  const currentValue = points[n - 1].y;

  // Only a positive slope that hasn't already reached the threshold projects a
  // future breach. Everything else = "no breach predicted" (Infinity ETA).
  const etaSeconds =
    slope > 0 && currentValue < threshold
      ? (threshold - currentValue) / slope
      : Infinity;

  return { slope, currentValue, etaSeconds };
}

/**
 * Turn an ETA in seconds into a short human phrase: nearest hour above 1h,
 * otherwise nearest minute (floored to a minimum of 1 minute so it never
 * reads "~0 minutes").
 */
function humanizeEta(etaSeconds) {
  if (etaSeconds >= 3600) {
    const hours = Math.round(etaSeconds / 3600);
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  const minutes = Math.max(1, Math.round(etaSeconds / 60));
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/**
 * Wrapper guaranteeing only one pass runs at a time (setInterval does not wait
 * for an async callback, so a slow tick could otherwise overlap the next and
 * race the dedup check).
 */
async function runGuarded() {
  if (isRunning) {
    console.log('[trendChecker] previous run still in progress — skipping this tick');
    return;
  }
  isRunning = true;
  let timer;
  try {
    await Promise.race([
      checkTrendsOnce(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('trend pass timed out')), RUN_TIMEOUT_MS);
      }),
    ]);
  } catch (err) {
    console.error('[trendChecker] error:', err.message);
  } finally {
    clearTimeout(timer);
    isRunning = false;
  }
}

/**
 * Run a single predictive pass over all servers. Exported so it can be tested
 * deterministically against a real (local/dev) database.
 */
async function checkTrendsOnce() {
  const lookbackMinutes = parseInt(process.env.TREND_LOOKBACK_MINUTES) || 30;
  const minSamples = parseInt(process.env.TREND_MIN_SAMPLES) || 6;
  const windowHours = parseInt(process.env.PREDICTION_WINDOW_HOURS) || 6;
  const windowSeconds = windowHours * 3600;

  const servers = await Server.find();
  const since = new Date(Date.now() - lookbackMinutes * 60 * 1000);

  const METRICS = [
    { type: 'cpu', field: 'cpuPercent', critKey: 'cpuCrit' },
    { type: 'ram', field: 'ramPercent', critKey: 'ramCrit' },
    { type: 'disk', field: 'diskPercent', critKey: 'diskCrit' },
  ];

  for (const server of servers) {
    // Isolate per-server failures so one bad server doesn't abort the tick.
    try {
      const metrics = await Metric.find({
        serverId: server._id,
        timestamp: { $gte: since },
      }).sort({ timestamp: 1 });

      // Too little history to trust a slope — skip this server entirely.
      if (metrics.length < minSamples) continue;

      for (const m of METRICS) {
        const crit = server.thresholds?.[m.critKey];
        if (crit == null) continue;

        const samples = metrics.map((doc) => ({
          timestamp: doc.timestamp,
          value: doc[m.field],
        }));
        const trend = computeTrend(samples, crit);
        if (!trend) continue;

        // What alerts already exist for this server+metric?
        const existingActive = await Alert.find({
          serverId: server._id,
          type: m.type,
          status: 'active',
        });
        const realAlert = existingActive.find((a) => !a.predictive);
        const predictiveAlert = existingActive.find((a) => a.predictive);

        const projectsBreach =
          trend.etaSeconds > 0 &&
          trend.etaSeconds <= windowSeconds &&
          trend.currentValue < crit;

        if (projectsBreach && !realAlert) {
          // Predictive hit. Only one predictive alert per server+type.
          if (predictiveAlert) continue;

          const etaSeconds = trend.etaSeconds;
          const projectedAt = new Date(Date.now() + etaSeconds * 1000);
          const businessFunctions = server.businessFunctions || [];
          const impactPrefix =
            businessFunctions.length > 0 ? `${businessFunctions[0]} at risk — ` : '';
          const summary =
            `${impactPrefix}${m.type.toUpperCase()} usage trending upward — ` +
            `projected to hit critical threshold (${crit}%) in ~${humanizeEta(etaSeconds)} at current rate.`;
          const rec = PREDICTIVE_ACTIONS[m.type];

          const owner = server.createdBy ? await User.findById(server.createdBy) : null;

          const alert = new Alert({
            serverId: server._id,
            severity: 'Warning',
            type: m.type,
            triggerAt: new Date(),
            businessFunctions,
            summary,
            recommendedAction: rec.summary,
            recommendedSteps: rec.steps,
            predictive: true,
            projectedAt,
            emailTo: owner?.email || '',
            emailStatus: 'pending',
            status: 'active',
            value: Math.round(trend.currentValue),
            threshold: crit,
          });

          await alert.save();
          console.log(
            `[trendChecker] Predictive ${m.type} alert for "${server.name}" ` +
              `(current ${Math.round(trend.currentValue)}%, ETA ~${humanizeEta(etaSeconds)})`,
          );

          if (owner && owner.emailNotifications) {
            const result = await sendAlertEmail(alert, server, owner);
            alert.emailStatus = result;
            await alert.save();
          }
        } else if (predictiveAlert && (!projectsBreach || realAlert)) {
          // The trend no longer projects a breach (flattened/fell), or a real
          // threshold alert now owns this metric — retire the predictive one.
          predictiveAlert.status = 'resolved';
          predictiveAlert.resolvedAt = new Date();
          await predictiveAlert.save();
          console.log(
            `[trendChecker] Predictive ${m.type} alert for "${server.name}" resolved ` +
              `(${realAlert ? 'superseded by real alert' : 'trend no longer projects breach'})`,
          );
        }
      }
    } catch (err) {
      console.error(`[trendChecker] error processing "${server.name}":`, err.message);
    }
  }
}

/**
 * Start the periodic checker. Interval configurable via TREND_CHECK_INTERVAL_SECONDS.
 */
function startTrendChecker() {
  const intervalSeconds = parseInt(process.env.TREND_CHECK_INTERVAL_SECONDS) || 300;
  if (intervalHandle) clearInterval(intervalHandle);

  console.log(`[trendChecker] Started — checking every ${intervalSeconds}s`);

  // First pass shortly after startup, then on a fixed interval. Offset from the
  // downChecker's first pass so they don't both fire at exactly startup+5s.
  setTimeout(runGuarded, 8000);
  intervalHandle = setInterval(runGuarded, intervalSeconds * 1000);

  return intervalHandle;
}

function stopTrendChecker() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = {
  startTrendChecker,
  stopTrendChecker,
  checkTrendsOnce,
  computeTrend,
  humanizeEta,
};
