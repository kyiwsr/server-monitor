const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const { auth, adminOnly } = require('../middleware/authMiddleware');

// All alert routes require authentication
router.use(auth);

/**
 * GET /api/alerts
 * Get alerts with filters
 * Query params: severity, status, serverId, type, limit, timeRange
 */
router.get('/', async (req, res) => {
  try {
    const {
      severity,
      status,
      serverId,
      type,
      limit = 100,
      timeRange,
    } = req.query;

    const query = {};

    // Build query filters
    if (severity) query.severity = { $regex: new RegExp(`^${severity}$`, 'i') };
    if (status) query.status = status.toLowerCase();
    if (serverId) query.serverId = serverId;
    if (type) query.type = type;

    // Time range filter
    if (timeRange) {
      const now = new Date();
      const rangeMatch = timeRange.match(/^(\d+)([hd])$/);
      if (rangeMatch) {
        const amount = parseInt(rangeMatch[1]);
        const unit = rangeMatch[2];
        const ms = unit === 'h' ? amount * 60 * 60 * 1000 : amount * 24 * 60 * 60 * 1000;
        query.triggerAt = { $gte: new Date(now - ms) };
      }
    }

    // Alerts are read-only monitoring data visible to all authenticated users;
    // no per-user server filtering (only admins can act on them / resolve).

    const limitNum = parseInt(limit) || 100;

    const alerts = await Alert.find(query)
      .populate('serverId', 'name host')
      .sort({ triggerAt: -1 })
      .limit(limitNum);

    // Format alerts for response
    const formattedAlerts = alerts.map((alert) => ({
      _id: alert._id,
      serverId: alert.serverId?._id,
      serverName: alert.serverId?.name || 'Unknown',
      serverHost: alert.serverId?.host || '',
      severity: alert.severity,
      type: alert.type,
      triggerAt: alert.triggerAt,
      businessFunctions: alert.businessFunctions,
      summary: alert.summary,
      recommendedAction: alert.recommendedAction,
      recommendedSteps: alert.recommendedSteps,
      predictive: alert.predictive,
      projectedAt: alert.projectedAt,
      emailTo: alert.emailTo,
      emailStatus: alert.emailStatus,
      resolvedAt: alert.resolvedAt,
      status: alert.status,
      value: alert.value,
      threshold: alert.threshold,
      createdAt: alert.createdAt,
    }));

    // Count stats
    const totalCount = alerts.length;
    const criticalCount = alerts.filter((a) => a.severity === 'Critical').length;
    const warningCount = alerts.filter((a) => a.severity === 'Warning').length;
    const resolvedCount = alerts.filter((a) => a.status === 'resolved').length;

    res.json({
      alerts: formattedAlerts,
      total: totalCount,
      criticalCount,
      warningCount,
      resolvedCount,
    });
  } catch (err) {
    console.error('Error fetching alerts:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * GET /api/alerts/:id
 * Get single alert details
 */
router.get('/:id', async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id).populate('serverId', 'name host');

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found.' });
    }

    // Reads are open to all authenticated users (read-only monitoring).

    res.json({
      _id: alert._id,
      serverId: alert.serverId?._id,
      serverName: alert.serverId?.name || 'Unknown',
      serverHost: alert.serverId?.host || '',
      severity: alert.severity,
      type: alert.type,
      triggerAt: alert.triggerAt,
      businessFunctions: alert.businessFunctions,
      summary: alert.summary,
      recommendedAction: alert.recommendedAction,
      recommendedSteps: alert.recommendedSteps,
      predictive: alert.predictive,
      projectedAt: alert.projectedAt,
      emailTo: alert.emailTo,
      emailStatus: alert.emailStatus,
      resolvedAt: alert.resolvedAt,
      status: alert.status,
      value: alert.value,
      threshold: alert.threshold,
      createdAt: alert.createdAt,
    });
  } catch (err) {
    console.error('Error fetching alert:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * PUT /api/alerts/:id/resolve
 * Manually resolve an alert — operational write, admin-only.
 */
router.put('/:id/resolve', adminOnly, async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found.' });
    }

    if (alert.status === 'resolved') {
      return res.json({ message: 'Alert is already resolved.', alert });
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    await alert.save();

    res.json({ message: 'Alert resolved successfully.', alert });
  } catch (err) {
    console.error('Error resolving alert:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
