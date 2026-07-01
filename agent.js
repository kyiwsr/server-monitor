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
 