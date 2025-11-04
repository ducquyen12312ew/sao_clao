// start.js
const { seedAdmins } = require('./seed-admins');

(async () => {
  try {
    if (process.env.SEED_ON_START === 'true') {
      console.log('SEED_ON_START=true → running admin seeder...');
      await seedAdmins();
      console.log('Seeding completed.');
    } else {
      console.log('SEED_ON_START not set → skipping seeding.');
    }
  } catch (e) {
    console.error('Seeding failed:', e);
    // vẫn cho phép app start, hoặc bạn có thể process.exit(1) nếu muốn fail deploy
  } finally {
    // start server
    require('./index.js'); // file server Express của bạn
  }
})();
