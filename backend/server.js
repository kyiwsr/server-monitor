const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const { startDownChecker } = require('./utils/downChecker');
const Metric = require('./models/Metric');

//Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    // Reconcile the metric TTL index with METRIC_RETENTION_DAYS (Mongoose won't
    // alter expireAfterSeconds on its own, so this surfaces/applies changes).
    Metric.syncRetentionTTL();
    // Start the background server-down alert scheduler once the DB is ready
    startDownChecker();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    // Without a database every request 500s — fail fast so the orchestrator
    // (docker-compose restart policy) can retry instead of serving a broken API.
    process.exit(1);
  });

//Routes
const metricsRoute = require('./routes/metrics');
const authRoute = require('./routes/auth');
const serversRoute = require('./routes/servers');
const alertsRoute = require('./routes/alerts');
const { router: installRoute } = require('./routes/install');

// Public routes (no JWT required)
app.use('/api/metrics', metricsRoute);

// Public onboarding assets (no JWT): GET /install.sh and GET /agent.js
app.use('/', installRoute);

// Auth routes
app.use('/api/auth', authRoute);

// Protected routes (JWT required via middleware in each router)
app.use('/api/servers', serversRoute);
app.use('/api/alerts', alertsRoute);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

//Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend is running on port ${PORT}`);
});
