/**
 * Server-Down Alert Scheduler
 * ===========================
 *
 * Background loop that detects servers which have stopped reporting metrics.
 * The metrics ingestion endpoint can only react to data that arrives — a server
 * that goes offline sends nothing, so "down" alerts must be generated here.
 *
 * On each tick, for every registered server that has reported at least once:
 *   - If (now - lastDataSent) > thresholds.downAfterSeconds  -> mark Down,
 *     create a Critical "down" alert (once) and email the owner.
 *   - Otherwise, if an active "down" alert exists -> auto-resolve it (recovery).
 *
 * Servers that have never reported (lastDataSent == null) are skipped to avoid
 * noisy alerts on freshly-registered servers that have not been connected yet.
 */

const Server = require('../models/Server');
const Alert = require('../models/Alert');
const User = require('../models/User');
const { sendAlertEmail } = require('./emailService');

const DOWN_RECOMMENDED_ACTION = {
  summary:
    'Server is unreachable — no metrics received within the configured limit. ' +
    'Check whether the server is powered on, verify network connectivity, and confirm the monitoring agent is running.',
  steps: [
    'Confirm the server is powered on and reachable (ping / provider console).',
    'Verify network connectivity and firewall rules between the server and this dashboard.',
    'Check that the monitoring agent service is running (e.g. `systemctl status`).',
    'Review recent system logs for a crash, reboot, or resource exhaustion.',
  ],
};

let intervalHandle = null;
let isRunning = false;

// Safety net: if a pass somehow never settles, this bounds how long the
// isRunning flag can stay stuck so the scheduler can't wedge permanently.
const RUN_TIMEOUT_MS = 4 * 60 * 1000;

/**
 * Wrapper that guarantees only one pass runs at a time. setInterval does not
 * wait for an async callback to finish, so a slow tick (e.g. several down
 * servers + slow SMTP) could otherwise overlap the next one and race the
 * dedup check, producing duplicate alerts and duplicate emails.
 */
async function runGuarded() {
  if (isRunning) {
    console.log('[downChecker] previous run still in progress — skipping this tick');
    return;
  }
  isRunning = true;
  let timer;
  try {
    await Promise.race([
      checkServersOnce(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('check pass timed out')), RUN_TIMEOUT_MS);
      }),
    ]);
  } catch (err) {
    console.error('[downChecker] error:', err.message);
  } finally {
    clearTimeout(timer);
    isRunning = false;
  }
}

/**
 * Run a single pass over all servers. Exported so it can be tested deterministically.
 */
async function checkServersOnce() {
  const servers = await Server.find();
  const now = Date.now();

  for (const server of servers) {
    // Isolate per-server failures so a transient error on one server does not
    // abort evaluation of the rest in this tick.
    try {
      // Never reported yet — skip (avoids alerting on servers that were just added)
      if (!server.lastDataSent) continue;

      const secondsSinceLastData = (now - new Date(server.lastDataSent).getTime()) / 1000;
      const downAfter = server.thresholds?.downAfterSeconds ?? 60;
      const isDown = secondsSinceLastData > downAfter;

      const existingDownAlert = await Alert.findOne({
        serverId: server._id,
        type: 'down',
        status: 'active',
      });

      if (isDown) {
        // Persist status so the dashboard reflects it and recovery can be detected
        if (server.status !== 'Down') {
          server.status = 'Down';
          await server.save();
        }

        if (!existingDownAlert) {
          const owner = server.createdBy ? await User.findById(server.createdBy) : null;
          const businessFunctions = server.businessFunctions || [];
          // Lead with the first business function to make the impact concrete
          // when the server has any assigned; otherwise use the generic wording.
          const impactPrefix =
            businessFunctions.length > 0 ? `${businessFunctions[0]} at risk — ` : '';
          const summary =
            `${impactPrefix}${server.name} is unreachable — no data received for ` +
            `${Math.round(secondsSinceLastData)}s (limit ${downAfter}s).`;

          const alert = new Alert({
            serverId: server._id,
            severity: 'Critical',
            type: 'down',
            triggerAt: new Date(),
            businessFunctions,
            summary,
            recommendedAction: DOWN_RECOMMENDED_ACTION.summary,
            recommendedSteps: DOWN_RECOMMENDED_ACTION.steps,
            emailTo: owner?.email || '',
            emailStatus: 'pending',
            status: 'active',
            value: Math.round(secondsSinceLastData),
            threshold: downAfter,
          });

          await alert.save();
          console.log(`[downChecker] Down alert created for "${server.name}"`);

          // Email the owner if they exist and have notifications enabled
          if (owner && owner.emailNotifications) {
            const result = await sendAlertEmail(alert, server, owner);
            // Persist the outcome either way — 'failed' must not be left as
            // 'pending', which conflates "gave up" with "not tried yet".
            alert.emailStatus = result;
            await alert.save();
          }
        }
      } else if (existingDownAlert) {
        // Server is reporting again — auto-resolve the down alert (recovery)
        existingDownAlert.status = 'resolved';
        existingDownAlert.resolvedAt = new Date();
        await existingDownAlert.save();
        console.log(`[downChecker] "${server.name}" back online — down alert resolved`);
      }
    } catch (err) {
      console.error(`[downChecker] error processing "${server.name}":`, err.message);
    }
  }
}

/**
 * Start the periodic checker. Interval configurable via DOWN_CHECK_INTERVAL_SECONDS.
 */
function startDownChecker() {
  const intervalSeconds = parseInt(process.env.DOWN_CHECK_INTERVAL_SECONDS) || 30;
  if (intervalHandle) clearInterval(intervalHandle);

  console.log(`[downChecker] Started — checking every ${intervalSeconds}s`);

  // First pass shortly after startup, then on a fixed interval.
  // runGuarded prevents overlapping passes if a tick runs long.
  setTimeout(runGuarded, 5000);
  intervalHandle = setInterval(runGuarded, intervalSeconds * 1000);

  return intervalHandle;
}

function stopDownChecker() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = { startDownChecker, stopDownChecker, checkServersOnce };
