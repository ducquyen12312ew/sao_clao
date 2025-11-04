const bcrypt = require('bcrypt');
const { connectDB, UserCollection } = require('./config');

async function seedAdmins() {
  try {
    await connectDB();

    const admins = [
      { username: 'admin1', name: 'Admin One', email: 'admin1@saoclao.com' },
      { username: 'admin2', name: 'Admin Two', email: 'admin2@saoclao.com' },
      { username: 'admin3', name: 'Admin Three', email: 'admin3@saoclao.com' }
    ];

    const passwordHash = await bcrypt.hash('admin123', 10);

    for (const admin of admins) {
      const exists = await UserCollection.findOne({ username: admin.username });
      
      if (!exists) {
        await UserCollection.create({
          ...admin,
          passwordHash,
          role: 'admin'
        });
        console.log(`Created admin: ${admin.username}`);
      } else {
        console.log(`Admin ${admin.username} already exists`);
      }
    }

    console.log('Admin seeding completed');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seedAdmins();