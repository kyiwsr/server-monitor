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
    const {
      token,
      timestamp,
      cpuPercent,
      ramPercent,
      diskPercent,
      uptimeSeconds,
    } = req.body;

    // Find server by matching token
    const servers = await Server.find();
    let matchedServer = null;

    for (const server of servers) {
      const isMatch = await bcrypt.compare(token, server.agentToken);
      if (isMatch) {
        matchedServer = server;
        break;
      }
    }

    if (!matchedServer) {
      console.log('Invalid token received');
      return res.status(401).json({ error: 'Invalid token' });
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
            if (emailResult !== 'failed') {
              newAlert.emailStatus = emailResult;
              await newAlert.save();
            }
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
