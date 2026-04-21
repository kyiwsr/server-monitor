const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();
const Server = require('./models/Server');

const seedServer = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const Token = 'agent-token-demo';

    const hashedToken = await bcrypt.hash(Token, 10);

    const serverExist = await Server.findOne({ name: 'Server-demo' });
    if (serverExist) {
      console.log('Server already seeded');
      process.exit(0);
    }

    const server = new Server({
      name: 'Server-demo',
      host: '192.168.0.173',
      description: 'Test server',
      businessFunctions: ['Website', 'Point of Sale'],
      agentToken: hashedToken,
      thresholds: {
        cpuWarn: 70,
        cpuCrit: 90,
        ramWarn: 70,
        ramCrit: 90,
        diskWarn: 75,
        diskCrit: 90,
        downAfterSeconds: 60,
      },
      status: 'Ok',
    });

    await server.save();

    console.log(`Server seeded succesfully. \n Agent token: ${Token}`);

    process.exit(0);
  } catch (err) {
    console.log('Seed error:', err);
    process.exit(1);
  }
};

seedServer();
