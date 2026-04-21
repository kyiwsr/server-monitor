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

module.exports = router;
