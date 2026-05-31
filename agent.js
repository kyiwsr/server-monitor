/**
 * Linux Server Monitoring Agent
 * ==============================
 * 
 * This script collects system metrics (CPU, RAM, Disk, Uptime) and sends them
 * to the monitoring backend server.
 * 
 * Usage:
 *   1. Install Node.js on your Linux server (AlmaLinux, Ubuntu, etc.)
 *   2. Copy this file to the server
 *   3. Edit the CONFIGURATION section below
 *   4. Run: node agent.js
 * 
 * To run in background:
 *   nohup node agent.js > agent.log 2>&1 &
 * 
 * To run on boot (systemd):
 *   Create /etc/systemd/system/server-monitor-agent.service
 *   (see instructions at bottom of this file)
 */

// ============================================================
// CONFIGURATION - EDIT THESE VALUES
// ============================================================

const CONFIG = {
  // Backend server URL (your Windows machine running the backend)
  // Use the IP address of your host machine (run 'ipconfig' on Windows to find it)
  // For bridged adapter VM, use the host's LAN IP (e.g., 192.168.x.x)
  BACKEND_URL: 'http://192.168.0.100:3000/api/metrics',

  // Authentication token - MUST match what's stored in your backend
  // You can find this in backend/seed.js or create a new server record
  AGENT_TOKEN: 'agent-token-demo',

  // How often to collect and send metrics (in seconds)
  INTERVAL_SECONDS: 10,

  // Server name for logging purposes
  SERVER_NAME: 'AlmaLinux-VM',
};

// ============================================================
// DO NOT EDIT BELOW THIS LINE
// ============================================================

const http = require('http');
const https = require('https');
const { execSync } = require('child_process');
const os = require('os');

/**
 * Read CPU stats from /proc/stat for delta calculation
 */
function readCpuStats() {
  const stat = execSync("grep '^cpu ' /proc/stat", { encoding: 'utf8', timeout: 3000 });
  const parts = stat.trim().split(/\s+/).slice(1).map(Number);
  return { idle: parts[3], total: parts.reduce((a, b) => a + b, 0) };
}

/**
 * Collect system metrics using Linux commands
 */
function collectMetrics() {
  try {
    // CPU Usage: Real-time delta measurement using /proc/stat
    const stat1 = readCpuStats();
    // Sleep 500ms to measure real-time usage
    execSync("sleep 0.5", { encoding: 'utf8', timeout: 3000 });
    const stat2 = readCpuStats();

    const totalDelta = stat2.total - stat1.total;
    const idleDelta = stat2.idle - stat1.idle;
    const cpuPercent = totalDelta > 0 ? Math.round(((totalDelta - idleDelta) / totalDelta) * 100 * 100) / 100 : 0;

    // RAM Usage
    const memInfo = execSync(
      "free | grep Mem | awk '{print $3/$2 * 100.0}'",
      { encoding: 'utf8', timeout: 5000 }
    ).trim();
    const ramPercent = parseFloat(memInfo) || 0;

    // Disk Usage (root partition)
    const diskInfo = execSync(
      "df / | tail -1 | awk '{print $5}' | sed 's/%//'",
      { encoding: 'utf8', timeout: 5000 }
    ).trim();
    const diskPercent = parseFloat(diskInfo) || 0;

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
      const metrics = collectMetrics();
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
 * Create file: /etc/systemd/system/server-monitor-agent.service
 * 
 * [Unit]
 * Description=Server Monitor Agent
 * After=network.target
 * 
 * [Service]
 * Type=simple
 * User=root
 * ExecStart=/usr/bin/node /path/to/agent.js
 * Restart=always
 * RestartSec=10
 * 
 * [Install]
 * WantedBy=multi-user.target
 * 
 * Then run:
 *   sudo systemctl daemon-reload
 *   sudo systemctl enable server-monitor-agent
 *   sudo systemctl start server-monitor-agent
 *   sudo systemctl status server-monitor-agent
 */
