const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const Server = require('../models/Server');
const Metric = require('../models/Metric');
const Alert = require('../models/Alert');
const { auth, adminOnly } = require('../middleware/authMiddleware');

// All server management routes require authentication
router.use(auth);

/**
 * GET /api/servers
 * Get all servers (admin sees all, users see their own)
 */
router.get('/', async (req, res) => {
  try {
    let query = {};
    if (req.user.role !== 'admin') {
      query.createdBy = req.user._id;
    }

    const servers = await Server.find(query).select('-agentToken').sort({ createdAt: -1 });

    const serversWithMetrics = await Promise.all(
      servers.map(async (server) => {
        const latestMetric = await Metric.findOne({ serverId: server._id })
          .sort({ timestamp: -1 })
          .limit(1);

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
      }),
    );

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

    // Check ownership
    if (req.user.role !== 'admin' && server.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Get latest metric
    const latestMetric = await Metric.findOne({ serverId: server._id })
      .sort({ timestamp: -1 })
      .limit(1);

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
 */
router.post('/', async (req, res) => {
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
      status: 'Ok',
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
    });
  } catch (err) {
    console.error('Error creating server:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * PUT /api/servers/:id
 * Update server settings/thresholds
 */
router.put('/:id', async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found.' });
    }

    // Check ownership
    if (req.user.role !== 'admin' && server.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied.' });
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
 */
router.delete('/:id', async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found.' });
    }

    // Check ownership
    if (req.user.role !== 'admin' && server.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied.' });
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
 */
router.put('/:id/regenerate-token', async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found.' });
    }

    // Check ownership
    if (req.user.role !== 'admin' && server.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Generate a random token
    const rawToken = 'agent-' + crypto.randomBytes(16).toString('hex');
    const hashedToken = await bcrypt.hash(rawToken, 10);

    server.agentToken = hashedToken;
    await server.save();

    res.json({
      message: 'Token regenerated successfully.',
      token: rawToken,
      serverId: server._id,
      serverName: server.name,
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

    const now = new Date();
    let cutoffTime;

    const rangeMatch = timeRange.match(/^(\d+)([hd])$/);
    if (rangeMatch) {
      const amount = parseInt(rangeMatch[1]);
      const unit = rangeMatch[2];
      const ms = unit === 'h' ? amount * 60 * 60 * 1000 : amount * 24 * 60 * 60 * 1000;
      cutoffTime = new Date(now - ms);
    } else {
      cutoffTime = new Date(now - 24 * 60 * 60 * 1000);
    }

    const allMetrics = await Metric.find({
      serverId: id,
      timestamp: { $gte: cutoffTime },
    }).sort({ timestamp: 1 });

    res.json(allMetrics);
  } catch (err) {
    console.error('Error fetching metrics:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
