import jwt from 'jsonwebtoken';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const secret = process.env.JWT_SECRET || 'marketpulse_jwt_secret_key_2026_super_secure';
const testUser = { id: '6a0d3a085dbf28dbcabc76b9', email: 'nishankjain1125@gmail.com', name: 'Nishank Jain', role: 'user' };

const token = jwt.sign(testUser, secret, { expiresIn: '15m' });

console.log("Generated Token:", token);

async function run() {
  try {
    console.log("Sending query: 'why nifty falling today' to Express backend...");
    const res = await axios.post('http://localhost:5000/api/chat/message', {
      message: 'why nifty falling today'
    }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log("✅ Chat Response Status:", res.status);
    console.log("Response text summary:", res.data.message.substring(0, 150) + "...");
    console.log("Metadata returned successfully:", !!res.data.metadata);
    if (res.data.metadata) {
      console.log("- Symbol:", res.data.metadata.symbol);
      console.log("- Name:", res.data.metadata.name);
      console.log("- Price:", res.data.metadata.price);
      console.log("- News count:", res.data.metadata.news ? res.data.metadata.news.length : 0);
    }
  } catch (err) {
    console.error("❌ Chat API failed:", err.response ? err.response.data : err.message);
  }
}

run();
