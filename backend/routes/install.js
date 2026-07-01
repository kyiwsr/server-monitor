const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

/**
 * Public onboarding routes (NO JWT — these serve static installer assets).
 *
 *   GET /agent.js    -> the raw Linux agent source (served to the target server)
 *   GET /install.sh  -> a one-line installer shell script
 *
 * The install.sh is designed to be piped straight into bash with the token and
 * backend URL supplied as environment variables, e.g.:
 *
 *   curl -sSL http://<host>/install.sh | \
 *     AGENT_TOKEN=xxx BACKEND_URL=http://<host>:3000/api/metrics bash
 *
 * Nothing secret is served here: agent.js contains no credentials, and the
 * token is provided by the operator at install time (never embedded server-side).
 */

// agent.js lives at the repository root, one level above backend/.
const AGENT_JS_PATH = path.join(__dirname, '..', '..', 'agent.js');

/**
 * Resolve the public base URL of THIS backend (scheme + host, no trailing slash).
 * Precedence: PUBLIC_BASE_URL env var, then the incoming request's host header.
 * Never hardcodes localhost — falls back to whatever host the client used.
 */
function resolvePublicBaseUrl(req) {
  const fromEnv = process.env.PUBLIC_BASE_URL;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/+$/, '');
  }
  // Honour proxies (X-Forwarded-Proto/Host) when present, else the raw request.
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http')
    .split(',')[0]
    .trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  return `${proto}://${host}`.replace(/\/+$/, '');
}

/**
 * GET /agent.js
 * Serve the raw agent source so the installer can download it.
 */
router.get('/agent.js', (req, res) => {
  fs.readFile(AGENT_JS_PATH, 'utf8', (err, contents) => {
    if (err) {
      console.error('Error serving agent.js:', err.message);
      return res.status(500).type('text/plain').send('# Error: agent.js not found on the backend.\n');
    }
    res.type('application/javascript').send(contents);
  });
});

/**
 * Build the install.sh script text with backend download URLs baked in so the
 * script knows where to fetch agent.js from even when piped to bash.
 */
function buildInstallScript(baseUrl) {
  const agentUrl = `${baseUrl}/agent.js`;
  return `#!/usr/bin/env bash
#
# Server Monitor Agent — one-line installer
# =========================================
# Usage:
#   curl -sSL ${baseUrl}/install.sh | \\
#     AGENT_TOKEN=<your-token> BACKEND_URL=<backend>/api/metrics bash
#
# Required env vars (passed in front of 'bash' above):
#   AGENT_TOKEN   the per-server token shown once in the dashboard
#   BACKEND_URL   full metrics endpoint, e.g. ${baseUrl}/api/metrics
# Optional:
#   SERVER_NAME       friendly name (defaults to this host's hostname)
#   INTERVAL_SECONDS  reporting interval in seconds (default 10)
#   INSTALL_SERVICE   set to "0" to skip installing the systemd service
#
set -euo pipefail

INSTALL_DIR="/opt/server-monitor-agent"
CONFIG_FILE="\${INSTALL_DIR}/agent.config.env"
AGENT_URL="${agentUrl}"
SERVICE_NAME="server-monitor-agent"

echo "=========================================="
echo "  Server Monitor Agent installer"
echo "=========================================="

# --- 1. Validate required input --------------------------------------------
if [ -z "\${AGENT_TOKEN:-}" ]; then
  echo "ERROR: AGENT_TOKEN is not set." >&2
  echo "       Re-run with: AGENT_TOKEN=<token> BACKEND_URL=<url> bash" >&2
  exit 1
fi
if [ -z "\${BACKEND_URL:-}" ]; then
  echo "ERROR: BACKEND_URL is not set (e.g. ${baseUrl}/api/metrics)." >&2
  echo "       Re-run with: AGENT_TOKEN=<token> BACKEND_URL=<url> bash" >&2
  exit 1
fi

SERVER_NAME="\${SERVER_NAME:-$(hostname)}"
INTERVAL_SECONDS="\${INTERVAL_SECONDS:-10}"
INSTALL_SERVICE="\${INSTALL_SERVICE:-1}"

# --- 2. Check prerequisites -------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "WARNING: Node.js is not installed or not on PATH." >&2
  echo "         The agent needs Node.js (v18+ recommended). Install it, e.g.:" >&2
  echo "           Debian/Ubuntu:  sudo apt-get install -y nodejs" >&2
  echo "           RHEL/AlmaLinux: sudo dnf install -y nodejs" >&2
  echo "         Then re-run this installer." >&2
else
  echo "Node.js found: $(node --version)"
fi

DOWNLOADER=""
if command -v curl >/dev/null 2>&1; then
  DOWNLOADER="curl -sSL -o"
elif command -v wget >/dev/null 2>&1; then
  DOWNLOADER="wget -qO"
else
  echo "ERROR: neither curl nor wget is available to download the agent." >&2
  exit 1
fi

# --- 3. Install agent files -------------------------------------------------
echo "Installing to \${INSTALL_DIR} ..."
if [ "\$(id -u)" -ne 0 ]; then
  echo "NOTE: not running as root; using sudo for system paths."
  SUDO="sudo"
else
  SUDO=""
fi

\$SUDO mkdir -p "\${INSTALL_DIR}"

echo "Downloading agent from \${AGENT_URL} ..."
\$SUDO bash -c "\${DOWNLOADER} '\${INSTALL_DIR}/agent.js' '\${AGENT_URL}'"

# --- 4. Write config (env file next to agent.js) ---------------------------
echo "Writing config to \${CONFIG_FILE} ..."
\$SUDO bash -c "cat > '\${CONFIG_FILE}'" <<EOF
# Generated by install.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)
BACKEND_URL=\${BACKEND_URL}
AGENT_TOKEN=\${AGENT_TOKEN}
SERVER_NAME=\${SERVER_NAME}
INTERVAL_SECONDS=\${INTERVAL_SECONDS}
EOF
# Token is sensitive — lock the config file down.
\$SUDO chmod 600 "\${CONFIG_FILE}"

# --- 5. Optionally install + start the systemd service ---------------------
if [ "\${INSTALL_SERVICE}" = "1" ] && command -v systemctl >/dev/null 2>&1; then
  NODE_BIN="$(command -v node || echo /usr/bin/node)"
  echo "Installing systemd service (\${SERVICE_NAME}) ..."
  \$SUDO bash -c "cat > /etc/systemd/system/\${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Server Monitor Agent
After=network.target

[Service]
Type=simple
User=root
EnvironmentFile=\${CONFIG_FILE}
ExecStart=\${NODE_BIN} \${INSTALL_DIR}/agent.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
  \$SUDO systemctl daemon-reload
  \$SUDO systemctl enable "\${SERVICE_NAME}" >/dev/null 2>&1 || true
  \$SUDO systemctl restart "\${SERVICE_NAME}"
  echo ""
  echo "Done. The agent is running as a systemd service."
  echo "  Status: sudo systemctl status \${SERVICE_NAME}"
  echo "  Logs:   sudo journalctl -u \${SERVICE_NAME} -f"
else
  echo ""
  echo "Done. Agent installed to \${INSTALL_DIR}."
  echo "To run it now:"
  echo "  cd \${INSTALL_DIR} && node agent.js"
  echo "(systemd not used — config is read from \${CONFIG_FILE})"
fi
`;
}

/**
 * GET /install.sh
 * Serve the installer shell script (plain text so it's readable in a browser
 * and pipeable into bash).
 */
router.get('/install.sh', (req, res) => {
  const baseUrl = resolvePublicBaseUrl(req);
  const script = buildInstallScript(baseUrl);
  res.type('text/x-shellscript').send(script);
});

module.exports = { router, resolvePublicBaseUrl };
