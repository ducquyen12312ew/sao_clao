// seed-admins.js
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { MONGO_URI } = require('./config'); // export MONGO_URI từ config.js của bạn
const User = require('./models/User');     // model User của bạn

async function runSeed() {
  const rawPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  const admins = [
    { username: 'admin1', name: 'Admin One', email: 'admin1@saoclao.com' },
    { username: 'admin2', name: 'Admin Two', email: 'admin2@saoclao.com' },
    { username: 'admin3', name: 'Admin Three', email: 'admin3@saoclao.com' }
  ];

  for (const a of admins) {
    await User.findOneAndUpdate(
      { username: a.username },
      { $set: { name: a.name, email: a.email, passwordHash, role: 'admin' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`✓ upserted admin: ${a.username}`);
  }
}

async function seedAdmins() {
  if (!process.env.MONGO_URI && !MONGO_URI) throw new Error('Missing MONGO_URI');
  await mongoose.connect(process.env.MONGO_URI || MONGO_URI);
  await runSeed();
  await mongoose.connection.close();
}

module.exports = { seedAdmins, runSeed };
