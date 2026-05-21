import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'model'], required: true },
  text: { type: String, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  createdAt: { type: Date, default: Date.now }
});

const chatHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  messages: [chatMessageSchema],
  updatedAt: { type: Date, default: Date.now }
});

export const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema);
