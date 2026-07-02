/**
 * Linux Server Monitoring Agent
 * ==============================
 *
 * This script collects system metrics (CPU, RAM, Disk, Uptime) and sends them
 * to the monitoring backend server.
 *
 * CONFIGURATION (environment-driven — no code edits needed)
 * ---------------------------------------------------------
 * The agent reads its config from environment variables, falling back to an
 * optional config file placed next to this script. Precedence (highest first):
 *
 *   1. Environment variables:   BACKEND_URL, AGENT_TOKEN, SERVER_NAME, INTERVAL_SECONDS
 *   2. Config file next to agent.js:  agent.config.json  OR  agent.config.env
 *      (JSON: {"BACKEND_URL":"...","AGENT_TOKEN":"..."} — or KEY=VALUE lines)
 *
 * Required: BACKEND_URL, AGENT_TOKEN.
 * Optional: SERVER_NAME (defaults to the OS hostname), INTERVAL_SECONDS (default 10).
 *
 * Usage:
 *   1. Install Node.js on your Linux server (AlmaLinux, Ubuntu, etc.)
 *   2. Copy this file to the server
 *   3. Provide config via env vars OR an agent.config.json / agent.config.env file:
 *
 *        # Option A - environment variables (one-off run)
 *        BACKEND_URL='http://<host-ip>:3000/api/metrics' \
 *        AGENT_TOKEN='<your-agent-token>' \
 *        node agent.js
 *
 *        # Option B - config file next to agent.js (agent.config.env)
 *        printf 'BACKEND_URL=http://<host-ip>:3000/api/metrics\nAGENT_TOKEN=<your-agent-token>\n' \
 *          > agent.config.env
 *        node agent.js
 *
 * To run in background:
 *   nohup node agent.js > agent.log 2>&1 &
 *
 * To run on boot (systemd):
 *   Create /etc/systemd/system/server-monitor-agent.service
 *   (see instructions at bottom of this file)
 */

const http = require('http');
const https = require('https');
const { execSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIGURATION LOADING (env vars override an optional config file)
// ============================================================

// Candidate config files searched next to this script, in order.
const CONFIG_FILES = ['agent.config.json', 'agent.config.env', '.env'];

/**
 * Parse a very small KEY=VALUE (.env style) file with built-in fs only.
 * - Ignores blank lines and lines starting with '#'.
 * - Strips optional surrounding single/double quotes from values.
 * No external dependencies (no dotenv).
 */
function parseEnvFile(contents) {
  const out = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

/**
 * Load config values from the first config file found next to agent.js.
 * Supports JSON (.json) and KEY=VALUE (.env style). Returns {} if none found
 * or on parse error (env vars can still supply everything).
 */
function loadConfigFile() {
  for (const name of CONFIG_FILES) {
    const filePath = path.join(__dirname, name);
    if (!fs.existsSync(filePath)) continue;
    try {
      const contents = fs.readFileSync(filePath, 'utf8');
      if (name.endsWith('.json')) {
        return { source: filePath, values: JSON.parse(contents) };
      }
      return { source: filePath, values: parseEnvFile(contents) };
    } catch (err) {
      console.warn(`Warning: could not read config file ${filePath}: ${err.message}`);
      return { source: null, values: {} };
    }
  }
  return { source: null, values: {} };
}

const fileConfig = loadConfigFile();

// Resolve a single value: env var wins, then config file, then fallback.
function resolve(key, fallback) {
  if (process.env[key] !== undefined && process.env[key] !== '') {
    return process.env[key];
  }
  if (fileConfig.values[key] !== undefined && fileConfig.values[key] !== '') {
    return fileConfig.values[key];
  }
  return fallback;
}

const CONFIG = {
  BACKEND_URL: resolve('BACKEND_URL', undefined),
  AGENT_TOKEN: resolve('AGENT_TOKEN', undefined),
  // SERVER_NAME defaults to the OS hostname when not provided.
  SERVER_NAME: resolve('SERVER_NAME', os.hostname()),
  // INTERVAL_SECONDS is optional; default 10s. Coerced to a positive number.
  INTERVAL_SECONDS: (() => {
    const raw = resolve('INTERVAL_SECONDS', '10');
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 10;
  })(),
};

/**
 * Validate required config and exit gracefully (no stack trace) if anything
 * essential is missing, with a friendly, actionable message.
 */
function validateConfig() {
  const missing = [];
  if (!CONFIG.BACKEND_URL) missing.push('BACKEND_URL');
  if (!CONFIG.AGENT_TOKEN) missing.push('AGENT_TOKEN');
  if (missing.length === 0) return;

  console.error('');
  console.error('Server Monitor Agent — configuration error');
  console.error('===========================================');
  console.error(`Missing required config value(s): ${missing.join(', ')}`);
  console.error('');
  console.error('Set them in ONE of these ways (environment variables take priority):');
  console.error('');
  console.error('  1) Environment variables, e.g.:');
  console.error("       BACKEND_URL='http://<host-ip>:3000/api/metrics' \\");
  console.error("       AGENT_TOKEN='<your-agent-token>' \\");
  console.error('       node agent.js');
  console.error('');
  console.error(`  2) A config file next to agent.js (${CONFIG_FILES.join(' or ')}):`);
  console.error('       # agent.config.env');
  console.error('       BACKEND_URL=http://<host-ip>:3000/api/metrics');
  console.error('       AGENT_TOKEN=<your-agent-token>');
  console.error('');
  console.error('  BACKEND_URL should point at your backend, e.g. http://<host-ip>:3000/api/metrics');
  console.error('  AGENT_TOKEN is the token shown when you add the server in the dashboard.');
  console.error('  SERVER_NAME is optional (defaults to this host\'s hostname).');
  console.error('');
  process.exit(1);
}

validateConfig();

/**
 * Read CPU stats from /proc/stat for delta calculation.
 * Uses fs (not a shell-out) so it doesn't spawn a process each cycle.
 */
function readCpuStats() {
  const stat = fs.readFileSync('/proc/stat', 'utf8');
  const line = stat.split('\n').find((l) => l.startsWith('cpu '));
  const parts = line.trim().split(/\s+/).slice(1).map(Number);
  return { idle: parts[3], total: parts.reduce((a, b) => a + b, 0) };
}

/**
 * RAM usage percent from /proc/meminfo (no shell-out). Prefers MemAvailable
 * (kernel's best estimate of reclaimable memory); falls back to Free+Buffers+
 * Cached on older kernels that don't expose it.
 */
function readMemPercent() {
  const info = fs.readFileSync('/proc/meminfo', 'utf8');
  const field = (key) => {
    const m = info.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'));
    return m ? Number(m[1]) : null;
  };
  const total = field('MemTotal');
  if (!total) return 0;
  let available = field('MemAvailable');
  if (available == null) {
    available = (field('MemFree') || 0) + (field('Buffers') || 0) + (field('Cached') || 0);
  }
  return ((total - available) / total) * 100;
}

/**
 * Disk usage percent for the root filesystem. Prefers fs.statfs (Node >= 18.15,
 * no shell-out); falls back to `df` on older Node runtimes.
 */
function readDiskPercent() {
  return new Promise((resolve) => {
    if (typeof fs.statfs === 'function') {
      fs.statfs('/', (err, s) => {
        if (err || !s || !s.blocks) return resolve(readDiskPercentViaDf());
        // Mirror df's "Use%": used / (used + available to non-root).
        const used = s.blocks - s.bfree;
        const denom = used + s.bavail;
        resolve(denom > 0 ? (used / denom) * 100 : 0);
      });
    } else {
      resolve(readDiskPercentViaDf());
    }
  });
}

function readDiskPercentViaDf() {
  try {
    const out = execSync("df / | tail -1 | awk '{print $5}' | sed 's/%//'", {
      encoding: 'utf8',
      timeout: 5000,
    }).trim();
    return parseFloat(out) || 0;
  } catch {
    return 0;
  }
}

/**
 * Collect system metrics from /proc (async — no blocking sleep or shell pipes).
 */
async function collectMetrics() {
  try {
    // CPU Usage: two /proc/stat samples 500ms apart. The delay is a non-blocking
    // setTimeout (the old execSync("sleep 0.5") froze the whole event loop).
    const stat1 = readCpuStats();
    await new Promise((r) => setTimeout(r, 500));
    const stat2 = readCpuStats();

    const totalDelta = stat2.total - stat1.total;
    const idleDelta = stat2.idle - stat1.idle;
    const cpuPercent = totalDelta > 0 ? ((totalDelta - idleDelta) / totalDelta) * 100 : 0;

    const ramPercent = readMemPercent();
    const diskPercent = await readDiskPercent();

    // Uptime in seconds
    const uptimeSeconds = Math.floor(os.uptime());

    return {
      cpuPercent: Math.round(cpuPercent * 100) / 100,
      ramPercent: Math.round(ramPercent * 100) / 100,
      diskPercent: Math.round(diskPercent * 100) / 100,
      uptimeSeconds,
    };
  } catch (err) {
    console.error(`[${CONFIG.SERVER_NAME}] Error collecting metrics:`, err.message);
    return null;
  }
}

/**
 * Send metrics to the backend server
 */
function sendMetrics(metrics) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      token: CONFIG.AGENT_TOKEN,
      timestamp: new Date().toISOString(),
      cpuPercent: metrics.cpuPercent,
      ramPercent: metrics.ramPercent,
      diskPercent: metrics.diskPercent,
      uptimeSeconds: metrics.uptimeSeconds,
    });

    const url = new URL(CONFIG.BACKEND_URL);
    const isHttps = url.protocol === 'https:';
    const transport = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 10000,
    };

    const req = transport.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(
            `[${CONFIG.SERVER_NAME}] Sent: CPU=${metrics.cpuPercent}% | RAM=${metrics.ramPercent}% | Disk=${metrics.diskPercent}% | Uptime=${metrics.uptimeSeconds}s`
          );
          resolve(body);
        } else {
          console.error(
            `[${CONFIG.SERVER_NAME}] Server returned status ${res.statusCode}: ${body}`
          );
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error(`[${CONFIG.SERVER_NAME}] Connection error:`, err.message);
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      console.error(`[${CONFIG.SERVER_NAME}] Request timed out`);
      reject(new Error('Timeout'));
    });

    req.write(data);
    req.end();
  });
}

/**
 * Main loop
 */
async function main() {
  console.log('========================================');
  console.log(`  Server Monitor Agent`);
  console.log(`  Server: ${CONFIG.SERVER_NAME}`);
  console.log(`  Backend: ${CONFIG.BACKEND_URL}`);
  console.log(`  Interval: ${CONFIG.INTERVAL_SECONDS}s`);
  console.log('========================================');
  console.log('');

  // Test backend connectivity first
  console.log(`[${CONFIG.SERVER_NAME}] Testing backend connectivity...`);
  try {
    const testMetrics = {
      cpuPercent: 0,
      ramPercent: 0,
      diskPercent: 0,
      uptimeSeconds: 0,
    };
    await sendMetrics(testMetrics);
    console.log(`[${CONFIG.SERVER_NAME}] Backend connection OK!`);
  } catch (err) {
    console.warn(
      `[${CONFIG.SERVER_NAME}] Warning: Could not reach backend. Will retry...`
    );
  }

  console.log(`[${CONFIG.SERVER_NAME}] Starting monitoring loop...`);
  console.log('');

  // Continuous monitoring loop
  const runCycle = async () => {
    try {
      const metrics = await collectMetrics();
      if (metrics) {
        await sendMetrics(metrics);
      }
    } catch (err) {
      // Error already logged, just continue
    }
  };

  // Run immediately, then on interval
  await runCycle();
  setInterval(runCycle, CONFIG.INTERVAL_SECONDS * 1000);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n[${CONFIG.SERVER_NAME}] Agent stopped by user`);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(`\n[${CONFIG.SERVER_NAME}] Agent terminated`);
  process.exit(0);
});

// Uncaught exceptions should not crash the process
process.on('uncaughtException', (err) => {
  console.error(`[${CONFIG.SERVER_NAME}] Uncaught exception:`, err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error(`[${CONFIG.SERVER_NAME}] Unhandled rejection:`, reason);
});

// Start
main();

/**
 * SYSTEMD SERVICE SETUP (for auto-start on boot)
 * ==============================================
 *
 * Config is environment-driven. With systemd you have two options: inline
 * Environment= directives, or an EnvironmentFile= that holds the KEY=VALUE pairs.
 *
 * Create file: /etc/systemd/system/server-monitor-agent.service
 *
 * --- Option A: inline Environment= directives ---
 *
 * [Unit]
 * Description=Server Monitor Agent
 * After=network.target
 *
 * [Service]
 * Type=simple
 * User=root
 * Environment=BACKEND_URL=http://<host-ip>:3000/api/metrics
 * Environment=AGENT_TOKEN=<your-agent-token>
 * # Optional:
 * Environment=SERVER_NAME=my-web-server
 * Environment=INTERVAL_SECONDS=10
 * ExecStart=/usr/bin/node /path/to/agent.js
 * Restart=always
 * RestartSec=10
 *
 * [Install]
 * WantedBy=multi-user.target
 *
 * --- Option B: EnvironmentFile= (keeps the token out of the unit file) ---
 *
 * Create /etc/server-monitor-agent.env (chmod 600, root-owned):
 *   BACKEND_URL=http://<host-ip>:3000/api/metrics
 *   AGENT_TOKEN=<your-agent-token>
 *   # SERVER_NAME=my-web-server
 *   # INTERVAL_SECONDS=10
 *
 * Then in the [Service] section use:
 *   EnvironmentFile=/etc/server-monitor-agent.env
 *   ExecStart=/usr/bin/node /path/to/agent.js
 *
 * (You can also skip systemd env entirely and drop an agent.config.env /
 *  agent.config.json file next to agent.js — the agent reads it automatically.)
 *
 * Then run:
 *   sudo systemctl daemon-reload
 *   sudo systemctl enable server-monitor-agent
 *   sudo systemctl start server-monitor-agent
 *   sudo systemctl status server-monitor-agent
 */
