import mongoose from 'mongoose';
import { User } from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/marketpulse';

async function check() {
  try {
    await mongoose.connect(mongoUri);
    console.log("✅ Successfully connected to MongoDB.");
    
    const count = await User.countDocuments();
    console.log(`Total users in database: ${count}`);
    
    const users = await User.find({}, { name: 1, email: 1, role: 1, lastLogin: 1 });
    console.log("Users List:");
    console.log(JSON.stringify(users, null, 2));
    
    await mongoose.disconnect();
  } catch (err) {
    console.error("❌ Database query error:", err.message);
  }
}

check();
