const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const Server = require('../models/Server');
const Metric = require('../models/Metric');
const Alert = require('../models/Alert');
const { auth, adminOnly } = require('../middleware/authMiddleware');
const { resolvePublicBaseUrl } = require('./install');

// All server management routes require authentication
router.use(auth);

/**
 * Build the ready-to-copy one-line installer command for a server.
 * When `token` is a real value it is baked in; otherwise a <AGENT_TOKEN>
 * placeholder is used (the hashed token cannot be recovered after creation).
 * The backend host is derived from PUBLIC_BASE_URL / the request — never hardcoded.
 */
function buildInstallCommand(req, token, serverName) {
  const baseUrl = resolvePublicBaseUrl(req);
  const tokenValue = token || '<AGENT_TOKEN>';
  const namePart = serverName ? ` SERVER_NAME='${serverName}'` : '';
  return (
    `curl -sSL ${baseUrl}/install.sh | ` +
    `AGENT_TOKEN='${tokenValue}' ` +
    `BACKEND_URL='${baseUrl}/api/metrics'${namePart} bash`
  );
}

/**
 * GET /api/servers
 * Get all servers — read access for every authenticated user (Viewers monitor
 * all servers; only admins can manage them).
 */
router.get('/', async (req, res) => {
  try {
    const servers = await Server.find().select('-agentToken').sort({ createdAt: -1 });

    // Fetch the latest metric for ALL these servers in a single aggregation
    // instead of one Metric.findOne per server (previously N+1 queries per poll).
    const serverIds = servers.map((s) => s._id);
    const latestMetrics = await Metric.aggregate([
      { $match: { serverId: { $in: serverIds } } },
      { $sort: { serverId: 1, timestamp: -1 } },
      {
        $group: {
          _id: '$serverId',
          cpuPercent: { $first: '$cpuPercent' },
          ramPercent: { $first: '$ramPercent' },
          diskPercent: { $first: '$diskPercent' },
          uptime: { $first: '$uptime' },
        },
      },
    ]);
    const metricByServer = new Map(latestMetrics.map((m) => [m._id.toString(), m]));

    const serversWithMetrics = servers.map((server) => {
        const latestMetric = metricByServer.get(server._id.toString()) || null;

        // Check if server is "Down" (no data received within threshold)
        let effectiveStatus = server.status;
        if (server.lastDataSent) {
          const secondsSinceLastData =
            (Date.now() - new Date(server.lastDataSent).getTime()) / 1000;
          if (secondsSinceLastData > server.thresholds.downAfterSeconds) {
            effectiveStatus = 'Down';
          }
        } else if (!latestMetric) {
          effectiveStatus = 'Down';
        }

        return {
          _id: server._id,
          name: server.name,
          host: server.host,
          description: server.description,
          businessFunctions: server.businessFunctions,
          thresholds: server.thresholds,
          status: effectiveStatus,
          lastDataSent: server.lastDataSent,
          createdBy: server.createdBy,
          timezone: server.timezone,
          tags: server.tags,
          createdAt: server.createdAt,
          updatedAt: server.updatedAt,
          currentMetrics: latestMetric
            ? {
                cpuPercent: latestMetric.cpuPercent,
                ramPercent: latestMetric.ramPercent,
                diskPercent: latestMetric.diskPercent,
                uptime: latestMetric.uptime,
              }
            : null,
        };
    });

    res.json(serversWithMetrics);
  } catch (err) {
    console.error('Error fetching servers:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * GET /api/servers/:id
 * Get single server details
 */
router.get('/:id', async (req, res) => {
  try {
    const server = await Server.findById(req.params.id).select('-agentToken');
    if (!server) {
      return res.status(404).json({ error: 'Server not found.' });
    }

    // Reads are open to all authenticated users (read-only monitoring).

    // Get latest metric
    const latestMetric = await Metric.findOne({ serverId: server._id })
      .sort({ timestamp: -1 });

    // Check if server is "Down"
    let effectiveStatus = server.status;
    if (server.lastDataSent) {
      const secondsSinceLastData =
        (Date.now() - new Date(server.lastDataSent).getTime()) / 1000;
      if (secondsSinceLastData > server.thresholds.downAfterSeconds) {
        effectiveStatus = 'Down';
      }
    } else if (!latestMetric) {
      effectiveStatus = 'Down';
    }

    res.json({
      ...server.toObject(),
      status: effectiveStatus,
      // Installer command with a <AGENT_TOKEN> placeholder — the real token is
      // hashed and only shown once at create/regenerate time, so it can't be
      // recovered here. Frontend can show this as a re-install reference.
      installCommand: buildInstallCommand(req, null, server.name),
      currentMetrics: latestMetric
        ? {
            cpuPercent: latestMetric.cpuPercent,
            ramPercent: latestMetric.ramPercent,
            diskPercent: latestMetric.diskPercent,
            uptime: latestMetric.uptime,
          }
        : null,
    });
  } catch (err) {
    console.error('Error fetching server:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * POST /api/servers
 * Create a new server (generates token, returns plain token ONCE)
 * Admin-only — Viewers are read-only.
 */
router.post('/', adminOnly, async (req, res) => {
  try {
    const { name, host, description, businessFunctions, thresholds, timezone, tags } = req.body;

    if (!name || !host) {
      return res.status(400).json({ error: 'Name and host are required.' });
    }

    // Generate a random token
    const rawToken = 'agent-' + crypto.randomBytes(16).toString('hex');
    const hashedToken = await bcrypt.hash(rawToken, 10);

    const server = new Server({
      name,
      host,
      description: description || '',
      businessFunctions: businessFunctions || [],
      agentToken: hashedToken,
      agentTokenLookup: Server.hashTokenLookup(rawToken),
      thresholds: thresholds || {
        cpuWarn: 70,
        cpuCrit: 90,
        ramWarn: 70,
        ramCrit: 90,
        diskWarn: 75,
        diskCrit: 90,
        downAfterSeconds: 60,
      },
      createdBy: req.user._id,
      timezone: timezone || 'UTC',
      tags: tags || [],
      status: 'Normal',
    });

    await server.save();

    res.status(201).json({
      message: 'Server created successfully.',
      server: {
        _id: server._id,
        name: server.name,
        host: server.host,
        description: server.description,
        businessFunctions: server.businessFunctions,
        thresholds: server.thresholds,
        status: server.status,
        createdBy: server.createdBy,
        timezone: server.timezone,
        tags: server.tags,
      },
      // Return plain text token ONCE — it won't be shown again
      token: rawToken,
      // Ready-to-copy one-line installer with the token + backend URL baked in.
      installCommand: buildInstallCommand(req, rawToken, server.name),
    });
  } catch (err) {
    console.error('Error creating server:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * PUT /api/servers/:id
 * Update server settings/thresholds
 * Admin-only — Viewers are read-only.
 */
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found.' });
    }

    const { name, host, description, businessFunctions, thresholds, timezone, tags } = req.body;
    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (host !== undefined) updateData.host = host;
    if (description !== undefined) updateData.description = description;
    if (businessFunctions !== undefined) updateData.businessFunctions = businessFunctions;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (tags !== undefined) updateData.tags = tags;

    if (thresholds !== undefined) {
      const allowedThresholds = [
        'cpuWarn', 'cpuCrit', 'ramWarn', 'ramCrit',
        'diskWarn', 'diskCrit', 'downAfterSeconds',
      ];
      const sanitizedThresholds = {};
      for (const key of allowedThresholds) {
        if (thresholds[key] !== undefined) {
          sanitizedThresholds[key] = thresholds[key];
        }
      }
      if (Object.keys(sanitizedThresholds).length > 0) {
        updateData.thresholds = sanitizedThresholds;
      }
    }

    const updated = await Server.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    }).select('-agentToken');

    res.json(updated);
  } catch (err) {
    console.error('Error updating server:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * DELETE /api/servers/:id
 * Delete server and its metrics/alerts
 * Admin-only — Viewers are read-only.
 */
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found.' });
    }

    // Delete associated metrics and alerts
    await Metric.deleteMany({ serverId: server._id });
    await Alert.deleteMany({ serverId: server._id });
    await Server.findByIdAndDelete(req.params.id);

    res.json({ message: 'Server and associated data deleted successfully.' });
  } catch (err) {
    console.error('Error deleting server:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * PUT /api/servers/:id/regenerate-token
 * Generate new agent token
 * Admin-only — Viewers are read-only.
 */
router.put('/:id/regenerate-token', adminOnly, async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found.' });
    }

    // Generate a random token
    const rawToken = 'agent-' + crypto.randomBytes(16).toString('hex');
    const hashedToken = await bcrypt.hash(rawToken, 10);

    server.agentToken = hashedToken;
    server.agentTokenLookup = Server.hashTokenLookup(rawToken);
    await server.save();

    res.json({
      message: 'Token regenerated successfully.',
      token: rawToken,
      serverId: server._id,
      serverName: server.name,
      // Ready-to-copy one-line installer with the new token baked in.
      installCommand: buildInstallCommand(req, rawToken, server.name),
    });
  } catch (err) {
    console.error('Error regenerating token:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * GET /api/servers/:id/metrics
 * Get metrics for a specific server with time range
 */
router.get('/:id/metrics', async (req, res) => {
  try {
    const { id } = req.params;
    const timeRange = req.query.timeRange || '24h';

    // Reads are open to all authenticated users (read-only monitoring); still
    // 404 on an unknown id so the response is meaningful.
    const server = await Server.findById(id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found.' });
    }

    const now = new Date();

    let spanMs;
    const rangeMatch = timeRange.match(/^(\d+)([hd])$/);
    if (rangeMatch) {
      const amount = parseInt(rangeMatch[1]);
      const unit = rangeMatch[2];
      spanMs = unit === 'h' ? amount * 60 * 60 * 1000 : amount * 24 * 60 * 60 * 1000;
    } else {
      spanMs = 24 * 60 * 60 * 1000;
    }
    const cutoffTime = new Date(now - spanMs);
    const spanHours = spanMs / (60 * 60 * 1000);

    // Short ranges: return raw samples. Long ranges: downsample with
    // time-bucketed averages so the chart stays responsive (30d ~= 260k raw points).
    let bucketMinutes = 0;
    if (spanHours > 24 * 7) bucketMinutes = 180; // > 7 days -> 3h buckets
    else if (spanHours > 48) bucketMinutes = 30; // 2–7 days -> 30m buckets

    if (bucketMinutes === 0) {
      const allMetrics = await Metric.find({
        serverId: id,
        timestamp: { $gte: cutoffTime },
      }).sort({ timestamp: 1 });
      return res.json(allMetrics);
    }

    const aggregated = await Metric.aggregate([
      {
        $match: {
          serverId: server._id,
          timestamp: { $gte: cutoffTime },
        },
      },
      {
        $group: {
          _id: { $dateTrunc: { date: '$timestamp', unit: 'minute', binSize: bucketMinutes } },
          cpuPercent: { $avg: '$cpuPercent' },
          ramPercent: { $avg: '$ramPercent' },
          diskPercent: { $avg: '$diskPercent' },
          uptime: { $max: '$uptime' },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          timestamp: '$_id',
          cpuPercent: { $round: ['$cpuPercent', 2] },
          ramPercent: { $round: ['$ramPercent', 2] },
          diskPercent: { $round: ['$diskPercent', 2] },
          uptime: 1,
        },
      },
    ]);

    res.json(aggregated);
  } catch (err) {
    console.error('Error fetching metrics:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
