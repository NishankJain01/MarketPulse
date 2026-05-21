import express from 'express';
import axios from 'axios';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';

// POST /api/scam/analyze (Protected)
router.post('/analyze', verifyToken, async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length < 5) {
      return res.status(400).json({ message: "Stock tip text is too short to analyze. Must be at least 5 characters." });
    }

    try {
      const response = await axios.post(`${AI_SERVICE_URL}/scam/analyze`, { text }, { timeout: 8000 });
      return res.json(response.data);
    } catch (err) {
      console.error(`[scam-service] FastAPI scam analyze failed: ${err.message}`);
      return res.status(500).json({
        message: "Scam analyzer service is currently offline or unreachable.",
        error: err.message
      });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
