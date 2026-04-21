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

module.exports = mongoose.model('Metric', metricSchema);
