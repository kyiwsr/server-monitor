const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const Server = require('../models/Server');
const Metric = require('../models/Metric');

router.post('/metrics', async (req, res) => {
  try {
    const {
      token,
      timestamp,
      cpuPercent,
      ramPercent,
      diskPercent,
      uptimeSeconds,
    } = req.body;

    const servers = await Server.find();
    let matchedServer = null;

    for (const server of servers) {
      const isMatch = await bcrypt.compare(token, server.agentToken);
      if (isMatch) {
        matchedServer = server;
        break;
      }
    }

    if (!matchedServer) {
      console.log('Invalid token received');
      return res.status(401).json({ error: 'Invalid token' });
    }

    //Save metric
    const metric = new Metric({
      serverId: matchedServer._id,
      timestamp: timestamp || new Date(),
      cpuPercent,
      ramPercent,
      diskPercent,
      uptime: uptimeSeconds,
    });

    await metric.save();

    //Update lastDataSent
    matchedServer.lastDataSent = new Date();
    await matchedServer.save();

    console.log(
      `Metics received from server ${matchedServer.name} | CPU: ${cpuPercent}%, RAM: ${ramPercent}%, Disk: ${diskPercent}%`,
    );

    res.status(200).json({ message: 'Metrics stored succesfully' });
  } catch (err) {
    console.log('Error processing metrics', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/servers', async(req, res) => {
  try {
    const servers = await Server.find().select('-agentToken');

    const serversWithMetrics = await Promise.all(
      servers.map( async (server) => { 
        const latestMetric = await Metric.findOne({ serverId: server._id}).sort({timestamp: -1}).
        limit(1);
      
        return {
          _id: server._id,
          name: server.name,
          host: server.host,
          status: server.status,
          lastDataSent: server.lastDataSent,
          currentMetrics: latestMetric ? {
            cpuPercent: latestMetric.cpuPercent,
            ramPercent: latestMetric.ramPercent,
            diskPercent: latestMetric.diskPercent,
            uptime: latestMetric.uptime
          } : null
        };
      })
    );
  } catch (err){
    console.error('Error fetching server:', err);
    res.status(500).json({ error: 'Server error'});
  }
});

router.get('/servers/:id/metrics', async (req, res) => {
  try {
    const {id} = req.params;
    const timeRange = req.query.timeRange || '24h';

    //Calculate time cutoff based on range
    const now = new Date();
    let cutoffTime;

    if (timeRange === '1h') {
      cutoffTime = new Date(now - 60 * 60 * 1000);
    } else if (timeRange === '6h') {
      cutoffTime = new Date(now - 6 * 60 * 60 * 1000);
    } else if (timeRange === '24h') {
      cutoffTime = new Date(now - 24 * 60 * 60 * 1000);
    } else if (timeRange === '48h') {
      cutoffTime = new Date(now - 48 * 60 * 60 * 1000);
    } else {
      cutoffTime = new Date(now - 24 * 60 * 60 * 1000);
    }

    const allMetrics = await Metric.find({
      serverId: id,
      timestamp: {$gte: cutoffTime}
    }).sort({ timestamp: 1});

    const sampledMetrics = [];
    const sampleInterval = 5 * 60 * 1000;
    let lastSampleTime = 0;

    allMetrics.forEach(metric => {
      const metricTime = new Date(metric.timestamp).getTime();
      if (metricTime - lastSampleTime >= sampleInterval) {
        sampledMetrics.push(metric);
        lastSampleTime = metricTime;
      }
    });

    res.json(sampledMetrics)
  } catch (err) {
    console.error('Error fetching metrics:', err);
    res.status(500).json({error: 'Server error'});
  }
});

module.exports = router;
