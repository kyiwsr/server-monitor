const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const Server = require('../models/Server');
const Metric = require('../models/Metric');
const Alert = require('../models/Alert');
const User = require('../models/User');
const { sendAlertEmail } = require('../utils/emailService');

// Recommended actions for different alert types
const RECOMMENDED_ACTIONS = {
  cpu: {
    Warning: 'Monitor CPU usage trends. Consider reviewing running processes and optimizing resource usage.',
    Critical:
      'Immediately investigate high CPU processes. Consider scaling vertically, adding more CPU resources, or redistributing workloads.',
  },
  ram: {
    Warning: 'Monitor memory usage. Review applications for memory leaks and consider increasing available memory.',
    Critical:
      'Take immediate action on memory usage. Restart memory-intensive applications, consider adding more RAM, or enable swap.',
  },
  disk: {
    Warning: 'Monitor disk usage trends. Plan for disk cleanup or expansion soon.',
    Critical:
      'Critical disk space shortage. Free up disk space immediately by removing old logs, temporary files, or expanding disk capacity.',
  },
  down: {
    Warning: 'Server is unresponsive. Check network connectivity and server status.',
    Critical:
      'Server is down. Immediate action required: check if the server is powered on, check network connectivity, and review system logs.',
  },
};

/**
 * POST /api/metrics
 * Receives metrics from agent (NO JWT AUTH - uses token-based auth)
 * Also creates/resolves alerts based on threshold breaches
 */
router.post('/', async (req, res) => {
  try {
    let {
      token,
      timestamp,
      cpuPercent,
      ramPercent,
      diskPercent,
      uptimeSeconds,
    } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Authenticate the agent by token.
    // Fast path: look the server up by the indexed SHA-256 of the token (O(1)),
    // then bcrypt.compare only that single candidate to confirm.
    const lookup = Server.hashTokenLookup(token);
    let matchedServer = await Server.findOne({ agentTokenLookup: lookup });
    if (matchedServer) {
      const isMatch = await bcrypt.compare(token, matchedServer.agentToken);
      if (!isMatch) matchedServer = null;
    }

    // Legacy fallback + migration: servers created before agentTokenLookup
    // existed have no lookup key. Scan only those (a bounded set that shrinks to
    // zero as each migrates), bcrypt.compare, and backfill the lookup on the
    // first successful auth so subsequent requests take the fast path.
    if (!matchedServer) {
      const legacyServers = await Server.find({ agentTokenLookup: { $exists: false } });
      for (const server of legacyServers) {
        if (await bcrypt.compare(token, server.agentToken)) {
          matchedServer = server;
          matchedServer.agentTokenLookup = lookup; // persisted by save() below
          break;
        }
      }
    }

    if (!matchedServer) {
      console.log('Invalid token received');
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Validate & coerce numeric metric fields. Agents send numbers, but a
    // malformed payload (NaN, strings, out-of-range) would silently mis-classify
    // against thresholds or store garbage — reject with 400 instead.
    cpuPercent = Number(cpuPercent);
    ramPercent = Number(ramPercent);
    diskPercent = Number(diskPercent);
    uptimeSeconds = Number(uptimeSeconds);

    const inPercentRange = (n) => Number.isFinite(n) && n >= 0 && n <= 100;
    if (!inPercentRange(cpuPercent) || !inPercentRange(ramPercent) || !inPercentRange(diskPercent)) {
      return res.status(400).json({
        error: 'cpuPercent, ramPercent, and diskPercent must be numbers between 0 and 100.',
      });
    }
    if (!Number.isFinite(uptimeSeconds) || uptimeSeconds < 0) {
      return res.status(400).json({ error: 'uptimeSeconds must be a non-negative number.' });
    }

    // Save metric
    const metric = new Metric({
      serverId: matchedServer._id,
      timestamp: timestamp || new Date(),
      cpuPercent,
      ramPercent,
      diskPercent,
      uptime: uptimeSeconds,
    });

    await metric.save();

    // Update lastDataSent
    matchedServer.lastDataSent = new Date();

    // Calculate server status based on thresholds
    const thresholds = matchedServer.thresholds;
    let newStatus = 'Ok';

    // Check Critical thresholds first
    if (
      cpuPercent >= thresholds.cpuCrit ||
      ramPercent >= thresholds.ramCrit ||
      diskPercent >= thresholds.diskCrit
    ) {
      newStatus = 'Critical';
    } else if (
      cpuPercent >= thresholds.cpuWarn ||
      ramPercent >= thresholds.ramWarn ||
      diskPercent >= thresholds.diskWarn
    ) {
      newStatus = 'Warning';
    }

    matchedServer.status = newStatus;
    await matchedServer.save();

    // Server is reporting again — resolve any active "down" alert immediately
    // (the downChecker scheduler is the backstop; this makes recovery instant)
    const activeDownAlert = await Alert.findOne({
      serverId: matchedServer._id,
      type: 'down',
      status: 'active',
    });
    if (activeDownAlert) {
      activeDownAlert.status = 'resolved';
      activeDownAlert.resolvedAt = new Date();
      await activeDownAlert.save();
      console.log(`Down alert resolved (data resumed) for ${matchedServer.name}`);
    }

    console.log(
      `Metrics received from server ${matchedServer.name} | CPU: ${cpuPercent}%, RAM: ${ramPercent}%, Disk: ${diskPercent}% | Status: ${newStatus}`,
    );

    // === Alert Creation Logic ===
    // Check each metric against thresholds and create persistent alerts
    const checks = [
      {
        type: 'cpu',
        value: cpuPercent,
        warn: thresholds.cpuWarn,
        crit: thresholds.cpuCrit,
      },
      {
        type: 'ram',
        value: ramPercent,
        warn: thresholds.ramWarn,
        crit: thresholds.ramCrit,
      },
      {
        type: 'disk',
        value: diskPercent,
        warn: thresholds.diskWarn,
        crit: thresholds.diskCrit,
      },
    ];

    // Get server owner for email notification
    const serverOwner = matchedServer.createdBy
      ? await User.findById(matchedServer.createdBy)
      : null;

    for (const check of checks) {
      if (check.value == null) continue;

      let severity = null;
      let exceededThreshold = null;

      if (check.value >= check.crit) {
        severity = 'Critical';
        exceededThreshold = check.crit;
      } else if (check.value >= check.warn) {
        severity = 'Warning';
        exceededThreshold = check.warn;
      }

      if (severity) {
        // Check if an active alert already exists for this server + type
        const existingActiveAlert = await Alert.findOne({
          serverId: matchedServer._id,
          type: check.type,
          status: 'active',
        });

        if (!existingActiveAlert) {
          // Create new alert
          const summary = `${check.type.toUpperCase()} usage (${check.value}%) exceeded ${severity.toLowerCase()} threshold (${exceededThreshold}%)`;
          const recommendedAction =
            RECOMMENDED_ACTIONS[check.type]?.[severity] ||
            'Investigate and resolve the issue.';

          const newAlert = new Alert({
            serverId: matchedServer._id,
            severity,
            type: check.type,
            triggerAt: timestamp || new Date(),
            businessFunctions: matchedServer.businessFunctions || [],
            summary,
            recommendedAction,
            emailTo: serverOwner?.email || '',
            emailStatus: 'pending',
            status: 'active',
            value: check.value,
            threshold: exceededThreshold,
          });

          await newAlert.save();
          console.log(`Alert created: ${severity} - ${summary}`);

          // Send email notification if user exists and has notifications enabled
          if (serverOwner && serverOwner.emailNotifications) {
            const emailResult = await sendAlertEmail(newAlert, matchedServer, serverOwner);
            // Persist the outcome either way — 'failed' must not be left as
            // 'pending', which conflates "gave up" with "not tried yet".
            newAlert.emailStatus = emailResult;
            await newAlert.save();
          }
        }
      } else {
        // Value is back to normal - resolve any active alert for this server+type
        const activeAlert = await Alert.findOne({
          serverId: matchedServer._id,
          type: check.type,
          status: 'active',
        });

        if (activeAlert) {
          activeAlert.status = 'resolved';
          activeAlert.resolvedAt = new Date();
          await activeAlert.save();
          console.log(`Alert resolved: ${check.type} back to normal on ${matchedServer.name}`);
        }
      }
    }

    res.status(200).json({ message: 'Metrics stored successfully' });
  } catch (err) {
    console.log('Error processing metrics', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
