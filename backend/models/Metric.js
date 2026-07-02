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
const retentionDays = parseInt(process.env.METRIC_RETENTION_DAYS) || 30;
const retentionSeconds = retentionDays * 24 * 60 * 60;
metricSchema.index({ timestamp: 1 }, { expireAfterSeconds: retentionSeconds });

const Metric = mongoose.model('Metric', metricSchema);

/**
 * Reconcile the live TTL index with METRIC_RETENTION_DAYS.
 *
 * Mongoose builds the TTL index once but never alters `expireAfterSeconds`
 * afterwards, so changing METRIC_RETENTION_DAYS on an existing deployment is
 * otherwise a silent no-op. Call this once after the DB connects: it compares
 * the current index against the configured value and runs `collMod` to update
 * it in place, logging what it did (or a warning if it couldn't).
 */
Metric.syncRetentionTTL = async function syncRetentionTTL() {
  try {
    let indexes;
    try {
      indexes = await Metric.collection.indexes();
    } catch (err) {
      // Fresh database: the collection (and its TTL index) doesn't exist yet.
      // Mongoose will build the index with the configured value on first write.
      if (err.codeName === 'NamespaceNotFound' || /ns does not exist/i.test(err.message)) {
        return;
      }
      throw err;
    }
    // The TTL index is the single-key { timestamp: 1 } one carrying
    // expireAfterSeconds — NOT the compound { serverId: 1, timestamp: 1 } index.
    const ttlIndex = indexes.find(
      (ix) =>
        ix.key &&
        Object.keys(ix.key).length === 1 &&
        ix.key.timestamp === 1 &&
        'expireAfterSeconds' in ix,
    );

    // Not created yet — Mongoose will build it with the desired value.
    if (!ttlIndex) return;

    if (ttlIndex.expireAfterSeconds === retentionSeconds) {
      console.log(`[Metric] TTL retention = ${retentionDays} day(s)`);
      return;
    }

    console.warn(
      `[Metric] METRIC_RETENTION_DAYS changed: index has ` +
        `${ttlIndex.expireAfterSeconds}s, config wants ${retentionSeconds}s ` +
        `(${retentionDays} day(s)). Updating via collMod...`,
    );
    await mongoose.connection.db.command({
      collMod: Metric.collection.collectionName,
      index: { name: ttlIndex.name, expireAfterSeconds: retentionSeconds },
    });
    console.log(`[Metric] TTL retention updated to ${retentionDays} day(s)`);
  } catch (err) {
    console.warn(`[Metric] Could not reconcile TTL retention: ${err.message}`);
  }
};

module.exports = Metric;
