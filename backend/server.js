const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const { startDownChecker } = require('./utils/downChecker');

//Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    // Start the background server-down alert scheduler once the DB is ready
    startDownChecker();
  })
  .catch(err => console.error('MongodDB connection error:', err));

//Routes
const metricsRoute = require('./routes/metrics');
const authRoute = require('./routes/auth');
const serversRoute = require('./routes/servers');
const alertsRoute = require('./routes/alerts');

// Public routes (no JWT required)
app.use('/api/metrics', metricsRoute);

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
app.listen(process.env.PORT, () => {
  console.log(`Backend is running on port ${process.env.PORT}`);
});
