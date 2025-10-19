// seed-vietnamese-tracks.js
// Create this file in the root directory (same level as src/)

const mongoose = require('mongoose');
const { connectDB, TrackCollection } = require('./src/config');

const vietnameseTracks = [
  // Sơn Tùng M-TP
  { 
    title: "Nơi Này Có Anh", 
    artist: "Sơn Tùng M-TP", 
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", 
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273e5a25ed08d1e7e0fbb440cef",
    genres: ["Pop", "Ballad"],
    tags: ["romantic", "emotional", "slow"],
    mood: "romantic"
  },
  { 
    title: "Lạc Trôi", 
    artist: "Sơn Tùng M-TP", 
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", 
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273e5a25ed08d1e7e0fbb440cef",
    genres: ["Pop", "EDM"],
    tags: ["upbeat", "dance", "energetic"],
    mood: "energetic"
  },
  { 
    title: "Chúng Ta Không Thuộc Về Nhau", 
    artist: "Sơn Tùng M-TP", 
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", 
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273e5a25ed08d1e7e0fbb440cef",
    genres: ["Pop", "Ballad"],
    tags: ["sad", "breakup", "emotional"],
    mood: "sad"
  },
  { 
    title: "Hãy Trao Cho Anh", 
    artist: "Sơn Tùng M-TP ft. Snoop Dogg", 
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3", 
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273e5a25ed08d1e7e0fbb440cef",
    genres: ["Pop", "Hip-Hop", "Trap"],
    tags: ["party", "dance", "club"],
    mood: "party"
  },
  { 
    title: "Muộn Rồi Mà Sao Còn", 
    artist: "Sơn Tùng M-TP", 
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3", 
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273e5a25ed08d1e7e0fbb440cef",
    genres: ["Ballad", "R&B"],
    tags: ["chill", "night", "relax"],
    mood: "chill"
  },
  
  // Hoàng Thùy Linh
  { 
    title: "See Tình", 
    artist: "Hoàng Thùy Linh", 
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3", 
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273f7b7e6f3d6f5c3e6d7e8f9a0",
    genres: ["Pop", "Dance", "EDM"],
    tags: ["upbeat", "dance", "party", "catchy"],
    mood: "party"
  },
  { 
    title: "Để Mị Nói Cho Mà Nghe", 
    artist: "Hoàng Thùy Linh", 
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3", 
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273f7b7e6f3d6f5c3e6d7e8f9a0",
    genres: ["Pop", "Traditional"],
    tags: ["traditional", "cultural", "upbeat"],
    mood: "happy"
  },
  { 
    title: "Kẻ Cắp Gặp Bà Già", 
    artist: "Hoàng Thùy Linh", 
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3", 
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273f7b7e6f3d6f5c3e6d7e8f9a0",
    genres: ["Pop"],
    tags: ["fun", "quirky", "upbeat"],
    mood: "happy"
  },
  
  // Đen Vâu
  { 
    title: "Bài Này Chill Phết", 
    artist: "Đen Vâu ft. MIN", 
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", 
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273a1b2c3d4e5f6g7h8i9j0k1l2",
    genres: ["Hip-Hop", "Rap", "Chill"],
    tags: ["chill", "relax", "laid-back", "smooth"],
    mood: "chill"
  },
  { 
    title: "Đưa Nhau Đi Trốn", 
    artist: "Đen Vâu ft. Linh Cáo", 
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", 
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273a1b2c3d4e5f6g7h8i9j0k1l2",
    genres: ["Hip-Hop", "Rap"],
    tags: ["love", "adventure", "chill"],
    mood: "romantic"
  },
  { 
    title: "Anh Đếch Cần Gì Nhiều Ngoài Em", 
    artist: "Đen Vâu ft. Thành Đồng", 
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", 
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273a1b2c3d4e5f6g7h8i9j0k1l2",
    genres: ["Hip-Hop", "Rap"],
    tags: ["love", "emotional", "heartfelt"],
    mood: "romantic"
  },
  { 
    title: "Hai Triệu Năm", 
    artist: "Đen Vâu", 
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3", 
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273a1b2c3d4e5f6g7h8i9j0k1l2",
    genres: ["Hip-Hop", "Rap"],
    tags: ["storytelling", "life", "philosophical"],
    mood: "thoughtful"
  },
  { 
    title: "Mang Tiền Về Cho Mẹ", 
    artist: "Đen Vâu ft. Nguyên Thảo", 
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3", 
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273a1b2c3d4e5f6g7h8i9j0k1l2",
    genres: ["Hip-Hop", "Rap"],
    tags: ["family", "emotional", "inspiring"],
    mood: "emotional"
  },
  
  // Mỹ Tâm
  { 
    title: "Người Hãy Quên Em Đi", 
    artist: "Mỹ Tâm", 
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3", 
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273b2c3d4e5f6g7h8i9j0k1l2m3",
    genres: ["Ballad", "Pop"],
    tags: ["sad", "breakup", "emotional", "powerful"],
    mood: "sad"
  },
  { 
    title: "Ước Gì", 
    artist: "Mỹ Tâm", 
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3", 
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273b2c3d4e5f6g7h8i9j0k1l2m3",
    genres: ["Ballad", "Pop"],
    tags: ["wishing", "hope", "emotional"],
    mood: "hopeful"
  },
  { 
    title: "Như Một Giấc Mơ", 
    artist: "Mỹ Tâm", 
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3", 
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273b2c3d4e5f6g7h8i9j0k1l2m3",
    genres: ["Ballad", "Pop"],
    tags: ["dreamy", "romantic", "soft"],
    mood: "dreamy"
  },
  
  // Additional tracks for variety
  { 
    title: "Rời Bỏ", 
    artist: "Hòa Minzy", 
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", 
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273c3d4e5f6g7h8i9j0k1l2m3n4",
    genres: ["Ballad", "Pop"],
    tags: ["sad", "emotional", "powerful-vocals"],
    mood: "sad"
  },
  { 
    title: "Anh Nhà Ở Đâu Thế", 
    artist: "AMEE", 
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", 
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273d4e5f6g7h8i9j0k1l2m3n4o5",
    genres: ["Pop", "R&B"],
    tags: ["fun", "flirty", "catchy"],
    mood: "playful"
  },
  { 
    title: "Yêu Từ Đâu Mà Ra", 
    artist: "MIN ft. Mr.A", 
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", 
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273e5f6g7h8i9j0k1l2m3n4o5p6",
    genres: ["Pop", "Dance"],
    tags: ["upbeat", "fun", "catchy"],
    mood: "happy"
  }
];

async function seedData() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await connectDB();
    
    console.log('🗑️  Clearing existing tracks...');
    await TrackCollection.deleteMany({});
    
    console.log('🌱 Seeding Vietnamese tracks...');
    await TrackCollection.insertMany(vietnameseTracks);
    
    console.log(`✅ Successfully seeded ${vietnameseTracks.length} Vietnamese tracks!`);
    console.log('\n📊 Genre distribution:');
    
    // Count genres
    const genreCount = {};
    vietnameseTracks.forEach(track => {
      track.genres.forEach(genre => {
        genreCount[genre] = (genreCount[genre] || 0) + 1;
      });
    });
    
    Object.entries(genreCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([genre, count]) => {
        console.log(`   ${genre}: ${count} tracks`);
      });
    
    console.log('\n🎭 Mood distribution:');
    const moodCount = {};
    vietnameseTracks.forEach(track => {
      if (track.mood) {
        moodCount[track.mood] = (moodCount[track.mood] || 0) + 1;
      }
    });
    
    Object.entries(moodCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([mood, count]) => {
        console.log(`   ${mood}: ${count} tracks`);
      });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

seedData();