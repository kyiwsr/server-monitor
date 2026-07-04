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
    // Actionable step-by-step guidance backing the one-line recommendedAction.
    // Kept alongside (not replacing) recommendedAction so the email template and
    // existing UI that read the one-liner stay backward compatible.
    recommendedSteps: [{ type: String }],
    // Predictive (trend-based) alerts warn before a threshold is actually
    // crossed. `predictive: true` distinguishes a proactive heads-up from an
    // already-happened threshold breach; `projectedAt` is the estimated time the
    // metric is expected to reach its critical threshold at the current rate.
    predictive: { type: Boolean, default: false },
    projectedAt: { type: Date, default: null },
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
