const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    serverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Server',
      required: true,
    },
    severity: {
      type: String,
      enum: ['Warning', 'Critical'],
      required: true,
    },
    type: {
      type: String,
      enum: ['cpu', 'ram', 'disk', 'down'],
      required: true,
    },
    triggerAt: { type: Date, required: true },
    businessFunctions: [{ type: String }],
    summary: { type: String, required: true },
    recommendedAction: { type: String, required: true },
    emailTo: { type: String },
    emailStatus: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
    },
    resolvedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['active', 'resolved'],
      default: 'active',
    },
    value: { type: Number },
    threshold: { type: Number },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Alert', alertSchema);
