/**
 * End-to-end alert + email test — drives a server into a CRITICAL breach so the
 * backend creates an alert and emails the server owner.
 *
 *   AGENT_TOKEN=agent-xxxx node backend/scripts/test-alert.js
 *   AGENT_TOKEN=agent-xxxx BACKEND_URL=http://localhost:3000/api/metrics node backend/scripts/test-alert.js
 *
 * How it works:
 *   1. Sends a NORMAL reading first, which resolves any active alert for this
 *      server. (The backend keeps one active alert per server+type and only
 *      emails when a NEW alert is created, so we must clear old ones first.)
 *   2. Sends a CRITICAL CPU reading (96%), which creates a fresh Critical alert
 *      and triggers the email to the owner.
 *
 * Prerequisites for the EMAIL to actually send:
 *   - EMAIL_* configured and working (test with scripts/test-email.js first)
 *   - the server's owner has a valid email and emailNotifications enabled (default on)
 */
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000/api/metrics';
const AGENT_TOKEN = process.env.AGENT_TOKEN || process.argv[2];

if (!AGENT_TOKEN) {
  console.error('Missing token. Usage: AGENT_TOKEN=agent-xxxx node backend/scripts/test-alert.js');
  process.exit(1);
}

async function post(label, metrics) {
  const body = {
    token: AGENT_TOKEN,
    timestamp: new Date().toISOString(),
    uptimeSeconds: 3600,
    ...metrics,
  };
  const res = await fetch(BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log(`[${label}] HTTP ${res.status} -> ${text}`);
  if (!res.ok) throw new Error(`${label} failed (${res.status})`);
}

async function main() {
  console.log(`Target: ${BACKEND_URL}`);
  // 1. Normal reading — resolves any active alert so the next one is "new".
  await post('reset (normal)', { cpuPercent: 10, ramPercent: 10, diskPercent: 10 });
  await new Promise((r) => setTimeout(r, 1500));
  // 2. Critical reading — creates a Critical CPU alert + fires the email.
  await post('breach (critical)', { cpuPercent: 96, ramPercent: 20, diskPercent: 20 });

  console.log('\nDone. Now check:');
  console.log('  - Dashboard "Alerts" page: a new Critical CPU alert should appear.');
  console.log('  - The owner\'s inbox (or backend logs) for the alert email.');
  console.log('  - Backend console: "Alert created: Critical ..." and email send/skip line.');
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
