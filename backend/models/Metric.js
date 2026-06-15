const mongoose = require('mongoose');

const metricSchema = new mongoose.Schema({
  serverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Server',
    required: true,
  },
  timestamp: { type: Date, required: true },
  cpuPercent: { type: Number, required: true },
  ramPercent: { type: Number, required: true },
  diskPercent: { type: Number, required: true },
  uptime: { type: Number, required: true },
});

// Compound index for the per-server time-range queries used by the dashboard
metricSchema.index({ serverId: 1, timestamp: 1 });

// Data retention: MongoDB TTL monitor auto-deletes metrics older than the
// configured window (default 30 days) to keep storage bounded.
// NOTE: changing METRIC_RETENTION_DAYS after the index exists requires a
// collMod (e.g. db.metrics.collMod) — Mongoose won't alter expireAfterSeconds.
const retentionDays = parseInt(process.env.METRIC_RETENTION_DAYS) || 30;
metricSchema.index({ timestamp: 1 }, { expireAfterSeconds: retentionDays * 24 * 60 * 60 });

module.exports = mongoose.model('Metric', metricSchema);
