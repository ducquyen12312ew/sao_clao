#!/usr/bin/env node
/**
 * Script để xóa tất cả các session cũ hỏng trong MongoDB
 * Sử dụng: node scripts/clear-sessions.js
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

async function clearSessions() {
  const mongoUrl = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/MusicCloud';
  const client = new MongoClient(mongoUrl);

  try {
    await client.connect();
    console.log('✓ Kết nối MongoDB thành công');

    const db = client.db('MusicCloud');
    
    // Xóa collection sessions nếu tồn tại
    try {
      await db.collection('sessions').drop();
      console.log('✓ Đã xóa collection sessions cũ');
    } catch (err) {
      if (err.code === 26) {
        // Collection không tồn tại - không sao
        console.log('✓ Collection sessions không tồn tại (lần đầu)');
      } else {
        throw err;
      }
    }

    // Tạo index mới cho collection sessions
    await db.collection('sessions').createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 86400 * 7 } // TTL 7 ngày
    );
    console.log('✓ Đã tạo TTL index mới cho sessions');

    console.log('\n✓ Hoàn tất! Hãy khởi động lại server.');
    
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

clearSessions();
