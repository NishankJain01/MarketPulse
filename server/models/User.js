import mongoose from 'mongoose';

const portfolioItemSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  qty: { type: Number, required: true },
  avgBuy: { type: Number, required: true },
  addedAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  refreshTokens: [String],
  portfolio: [portfolioItemSchema],
  watchlist: [String],
  preferences: {
    theme: { type: String, default: 'dark' },
    riskProfile: { type: String, enum: ['conservative', 'moderate', 'aggressive'], default: 'moderate' }
  },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date }
});

export const User = mongoose.model('User', userSchema);
