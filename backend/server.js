const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(express.json());

//Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongodDB connection error:', err));

//Routes
const metricsRoute = require('./routes/metrics');
app.use('/api', metricsRoute);

//Start server
app.listen(process.env.PORT, () => {
  console.log(`Backend is running on port ${process.env.PORT}`);
});
