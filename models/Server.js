const mongoose = require('mongoose');

const serverSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    host: { type: String, required: true },
    description: { type: String },
    businessFuncstions: [{ type: String }],
    agentToken: { type: String, required: true },
    thresholds: {
      cpuWarn: { type: Number, default: 70 },
      cpuCrit: { type: Number, default: 90 },
      ramWarn: { type: Number, default: 70 },
      ramCrit: { type: Number, default: 90 },
      diskWarn: { type: Number, default: 75 },
      diskCrit: { type: Number, default: 90 },
      downAfterSeconds: { type: Number, default: 60 },
    },
    lastDataSent: { type: Date },
    status: { type: String, enum: ['OK', 'Warning', 'Critical', 'Down'] },
    default: 'OK',
    cretedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Server', serverSchema);