const mongoose = require('mongoose');
const crypto = require('crypto');

const serverSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    host: { type: String, required: true },
    description: { type: String },
    businessFunctions: [{ type: String }],
    agentToken: { type: String, required: true },
    // Fast O(1) lookup key: a deterministic SHA-256 hex of the raw agent token.
    // bcrypt hashes are not searchable, so authenticating a metrics POST used to
    // load every server and bcrypt.compare each one (O(N) hashing per request +
    // a DoS vector on bad tokens). We index this hash to find the one server,
    // then bcrypt.compare only that single candidate. Sparse: servers created
    // before this field existed won't have it and are migrated on first
    // successful auth (see routes/metrics.js).
    agentTokenLookup: { type: String, index: true, sparse: true },
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
    status: {
      type: String,
      enum: ['Normal', 'Warning', 'Critical', 'Down'],
      default: 'Normal',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timezone: { type: String, default: 'UTC' },
    tags: [{ type: String }],
  },
  { timestamps: true },
);

// Derive the indexed lookup key from a raw agent token. Kept on the model so
// creation, regeneration, and metrics auth all hash the token the same way.
serverSchema.statics.hashTokenLookup = function (rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
};

module.exports = mongoose.model('Server', serverSchema);
