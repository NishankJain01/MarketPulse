import express from 'express';
import axios from 'axios';
import { verifyToken } from '../middleware/authMiddleware.js';
import { ChatHistory } from '../models/ChatHistory.js';

const router = express.Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';

// GET /api/chat/history (Protected)
router.get('/history', verifyToken, async (req, res, next) => {
  try {
    let chat = await ChatHistory.findOne({ userId: req.user.id });
    if (!chat) {
      chat = new ChatHistory({ userId: req.user.id, messages: [] });
      await chat.save();
    }
    return res.json(chat.messages);
  } catch (error) {
    next(error);
  }
});

// POST /api/chat/message (Protected)
router.post('/message', verifyToken, async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || message.trim() === "") {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    // 1. Fetch existing user history
    let chat = await ChatHistory.findOne({ userId: req.user.id });
    if (!chat) {
      chat = new ChatHistory({ userId: req.user.id, messages: [] });
    }

    // Prepare history payload for FastAPI
    // Keep last 15 messages to prevent payload explosion while giving good context
    const historyPayload = chat.messages.slice(-15).map(m => ({
      role: m.role,
      text: m.text
    }));

    // Save user's message
    chat.messages.push({ role: 'user', text: message });

    let botResponse = "";
    let botMetadata = null;
    try {
      // 2. Call FastAPI chat route
      const response = await axios.post(`${AI_SERVICE_URL}/chat`, {
        message: message,
        history: historyPayload
      }, { timeout: 20000 });
      
      botResponse = response.data.response;
      botMetadata = response.data.metadata || null;
    } catch (err) {
      console.error(`[chat-service] FastAPI chat communication failed: ${err.message}`);
      botResponse = "I apologize, but I am experiencing difficulties communicating with my advanced analytical modules. Please ensure your backend services are active. \n\n*Risk Warning: Always verify trading signals independently.*";
      botMetadata = null;
    }

    // Save bot's response
    chat.messages.push({ role: 'model', text: botResponse, metadata: botMetadata });
    chat.updatedAt = new Date();
    await chat.save();

    return res.json({
      message: botResponse,
      metadata: botMetadata,
      history: chat.messages
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/chat/clear (Protected)
router.delete('/clear', verifyToken, async (req, res, next) => {
  try {
    const chat = await ChatHistory.findOne({ userId: req.user.id });
    if (chat) {
      chat.messages = [];
      chat.updatedAt = new Date();
      await chat.save();
    }
    return res.json({ message: "Conversation history cleared successfully" });
  } catch (error) {
    next(error);
  }
});

export default router;
