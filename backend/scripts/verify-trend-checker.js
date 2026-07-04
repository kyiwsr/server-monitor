/**
 * verify-trend-checker.js
 * =======================
 *
 * End-to-end verification of the predictive alert lifecycle against a REAL
 * (local/dev) MongoDB and the real Alert model + trendChecker.checkTrendsOnce.
 *
 *   Run:  node backend/scripts/verify-trend-checker.js
 *
 * Seeds throwaway servers/metrics (name prefix "TrendTest-"), drives the
 * checker's single-pass function directly, asserts on the resulting Alert
 * documents, then cleans everything up in a finally block regardless of outcome.
 *
 * SAFETY: refuses to run unless MONGODB_URI points at a local/dev database, so
 * it can never seed/delete against a real deployment. Follows the project's
 * standalone-script style (like seed.js) — no test framework.
 */

const assert = require('assert');
const mongoose = require('mongoose');
require('dotenv').config();

// Deterministic, reproducible parameters for the run.
process.env.TREND_LOOKBACK_MINUTES = '30';
process.env.TREND_MIN_SAMPLES = '6';
process.env.PREDICTION_WINDOW_HOURS = '6';

const Server = require('../models/Server');
const Metric = require('../models/Metric');
const Alert = require('../models/Alert');
const { checkTrendsOnce } = require('../utils/trendChecker');

const NAME_PREFIX = 'TrendTest-';
let failures = 0;

async function runCase(name, fn) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`FAIL  ${name}\n      ${err.message}`);
  }
}

// --- Safety guard: never touch a non-local database -------------------------
function assertLocalDatabase(uri) {
  if (!uri) {
    throw new Error('MONGODB_URI is not set — refusing to run.');
  }
  const isLocal =
    /(^|@|\/\/)(localhost|127\.0\.0\.1|mongo)(:|\/|$)/.test(uri) ||
    uri.includes('@mongo:'); // docker-compose service name
  if (!isLocal) {
    throw new Error(
      `MONGODB_URI (${uri}) does not look local (localhost/127.0.0.1/mongo). ` +
        'Refusing to run destructive test seeding against a non-local database.',
    );
  }
}

// --- Seed helpers -----------------------------------------------------------
async function createServer(name, businessFunctions = []) {
  return Server.create({
    name: NAME_PREFIX + name,
    host: '10.0.0.99',
    businessFunctions,
    agentToken: 'dummy-hash',
    agentTokenLookup: `trendtest-${name}`,
    thresholds: {
      cpuWarn: 70,
      cpuCrit: 90,
      ramWarn: 70,
      ramCrit: 90,
      diskWarn: 75,
      diskCrit: 90,
      downAfterSeconds: 60,
    },
    status: 'Normal',
  });
}

// Seed disk% readings (cpu/ram held low so only disk trends). Timestamps are
// backdated so the newest sample is ~now and they span within the lookback.
async function seedDiskMetrics(serverId, diskValues, stepSeconds = 120) {
  const now = Date.now();
  const n = diskValues.length;
  const docs = diskValues.map((v, i) => ({
    serverId,
    timestamp: new Date(now - (n - 1 - i) * stepSeconds * 1000),
    cpuPercent: 10,
    ramPercent: 10,
    diskPercent: v,
    uptime: 100000,
  }));
  await Metric.insertMany(docs);
}

async function activeDiskAlerts(serverId) {
  return Alert.find({ serverId, type: 'disk', status: 'active' });
}

async function cleanup() {
  const servers = await Server.find({ name: { $regex: `^${NAME_PREFIX}` } });
  const ids = servers.map((s) => s._id);
  if (ids.length) {
    await Alert.deleteMany({ serverId: { $in: ids } });
    await Metric.deleteMany({ serverId: { $in: ids } });
    await Server.deleteMany({ _id: { $in: ids } });
  }
}

// ---------------------------------------------------------------------------
async function main() {
  const uri = process.env.MONGODB_URI;
  assertLocalDatabase(uri);
  await mongoose.connect(uri);
  console.log(`Connected to ${uri}\n`);

  // Start from a clean slate in case a previous run was interrupted.
  await cleanup();

  try {
    // -- Scenario 1: rising disk, not yet critical -> one predictive alert ----
    await runCase('Rising disk (not critical) -> one predictive alert w/ steps', async () => {
      const server = await createServer('rising', ['Website']);
      // 8 samples: 60,62,...,74 — climbing, latest 74 < diskCrit 90.
      await seedDiskMetrics(
        server._id,
        Array.from({ length: 8 }, (_, i) => 60 + i * 2),
      );
      await checkTrendsOnce();

      const alerts = await activeDiskAlerts(server._id);
      assert.strictEqual(alerts.length, 1, `expected 1 active disk alert, got ${alerts.length}`);
      const a = alerts[0];
      assert.strictEqual(a.predictive, true, 'alert should be predictive');
      assert.strictEqual(a.severity, 'Warning', 'predictive alert should be Warning severity');
      assert.strictEqual(a.type, 'disk', 'type should be disk');
      assert.ok(a.projectedAt instanceof Date, 'projectedAt should be a Date');
      assert.ok(a.projectedAt.getTime() > Date.now(), 'projectedAt should be in the future');
      assert.ok(
        Array.isArray(a.recommendedSteps) && a.recommendedSteps.length > 0,
        'recommendedSteps should be non-empty',
      );
    });

    // -- Scenario 1b: too few samples -> no predictive alert (min-samples guard)
    await runCase('Fewer than TREND_MIN_SAMPLES -> no predictive alert', async () => {
      const server = await createServer('fewsamples');
      // Only 4 samples (< TREND_MIN_SAMPLES = 6), clearly rising.
      await seedDiskMetrics(server._id, [60, 65, 70, 75]);
      await checkTrendsOnce();

      const alerts = await activeDiskAlerts(server._id);
      assert.strictEqual(alerts.length, 0, `expected 0 alerts, got ${alerts.length}`);
    });

    // -- Scenario 2: already critical -> trend check creates NO predictive ----
    await runCase('Already critical -> trend check creates no predictive alert', async () => {
      const server = await createServer('critical');
      // 8 samples ending at 92 (>= diskCrit 90). Reactive path owns this case.
      await seedDiskMetrics(
        server._id,
        Array.from({ length: 8 }, (_, i) => 85 + i),
      );
      await checkTrendsOnce();

      const alerts = await activeDiskAlerts(server._id);
      const predictive = alerts.filter((a) => a.predictive);
      assert.strictEqual(
        predictive.length,
        0,
        `expected 0 predictive alerts, got ${predictive.length}`,
      );
    });

    // -- Scenario 3: predictive exists + trend flattens -> auto-resolve -------
    await runCase('Trend flattens -> existing predictive alert auto-resolves', async () => {
      const server = await createServer('flatten', ['Payments']);
      await seedDiskMetrics(
        server._id,
        Array.from({ length: 8 }, (_, i) => 60 + i * 2),
      );
      await checkTrendsOnce();
      let alerts = await activeDiskAlerts(server._id);
      assert.strictEqual(alerts.length, 1, 'predictive alert should exist after first pass');

      // Replace history with flat data (all ~74) and re-run.
      await Metric.deleteMany({ serverId: server._id });
      await seedDiskMetrics(server._id, Array.from({ length: 8 }, () => 74));
      await checkTrendsOnce();

      alerts = await activeDiskAlerts(server._id);
      assert.strictEqual(alerts.length, 0, `expected 0 active alerts, got ${alerts.length}`);
      const resolved = await Alert.findOne({
        serverId: server._id,
        type: 'disk',
        predictive: true,
        status: 'resolved',
      });
      assert.ok(resolved, 'predictive alert should now be resolved');
      assert.ok(resolved.resolvedAt instanceof Date, 'resolvedAt should be set');
    });

    // -- Scenario 4: predictive exists + real alert fires -> predictive retired
    await runCase('Real threshold alert present -> predictive alert resolved', async () => {
      const server = await createServer('superseded');
      await seedDiskMetrics(
        server._id,
        Array.from({ length: 8 }, (_, i) => 60 + i * 2),
      );
      await checkTrendsOnce();
      let alerts = await activeDiskAlerts(server._id);
      assert.strictEqual(alerts.length, 1, 'predictive alert should exist after first pass');

      // Simulate the reactive path having created a REAL (non-predictive) alert.
      await Alert.create({
        serverId: server._id,
        severity: 'Critical',
        type: 'disk',
        triggerAt: new Date(),
        businessFunctions: [],
        summary: 'DISK usage (91%) exceeded critical threshold (90%)',
        recommendedAction: 'Free up disk space immediately.',
        recommendedSteps: ['SSH in', 'df -h', 'clear logs'],
        predictive: false,
        status: 'active',
        value: 91,
        threshold: 90,
      });
      await checkTrendsOnce();

      // The predictive one must be resolved; the real one must remain active.
      const predictiveActive = await Alert.find({
        serverId: server._id,
        type: 'disk',
        predictive: true,
        status: 'active',
      });
      const realActive = await Alert.find({
        serverId: server._id,
        type: 'disk',
        predictive: false,
        status: 'active',
      });
      assert.strictEqual(predictiveActive.length, 0, 'predictive alert should be resolved');
      assert.strictEqual(realActive.length, 1, 'real alert should remain active');
    });

    // -- Scenario 5: business-function interpolation --------------------------
    await runCase('Business-function interpolation + generic fallback', async () => {
      const withBf = await createServer('withbf', ['Website']);
      await seedDiskMetrics(
        withBf._id,
        Array.from({ length: 8 }, (_, i) => 60 + i * 2),
      );
      await checkTrendsOnce();
      const a1 = (await activeDiskAlerts(withBf._id))[0];
      assert.ok(a1, 'alert should exist for server with business function');
      assert.ok(a1.summary.includes('Website'), `summary should mention "Website": ${a1.summary}`);

      const noBf = await createServer('nobf', []);
      await seedDiskMetrics(
        noBf._id,
        Array.from({ length: 8 }, (_, i) => 60 + i * 2),
      );
      await checkTrendsOnce();
      const a2 = (await activeDiskAlerts(noBf._id))[0];
      assert.ok(a2, 'alert should exist for server without business functions');
      assert.ok(
        !/undefined/i.test(a2.summary),
        `summary should not contain "undefined": ${a2.summary}`,
      );
      assert.ok(
        !/ at risk —/.test(a2.summary),
        `summary should use generic wording (no "at risk" prefix): ${a2.summary}`,
      );
      assert.ok(a2.summary.startsWith('DISK usage'), `expected generic start: ${a2.summary}`);
    });

    // -- Scenario 6: re-running with no data change -> no duplicate -----------
    await runCase('Re-run with no data change -> no duplicate alert', async () => {
      const server = await createServer('dedup');
      await seedDiskMetrics(
        server._id,
        Array.from({ length: 8 }, (_, i) => 60 + i * 2),
      );
      await checkTrendsOnce();
      await checkTrendsOnce(); // second identical pass

      const alerts = await activeDiskAlerts(server._id);
      assert.strictEqual(alerts.length, 1, `expected exactly 1 alert, got ${alerts.length}`);
    });
  } finally {
    await cleanup();
    await mongoose.disconnect();
  }

  console.log('');
  if (failures > 0) {
    console.error(`${failures} scenario(s) FAILED`);
    process.exit(1);
  }
  console.log('All trend-checker scenarios passed.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
