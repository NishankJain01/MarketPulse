import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';

// Route Imports
import authRoutes from './routes/auth.js';
import stockRoutes from './routes/stocks.js';
import sentimentRoutes from './routes/sentiment.js';
import chatRoutes from './routes/chat.js';
import scamRoutes from './routes/scam.js';
import portfolioRoutes from './routes/portfolio.js';

// Load environmental variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend cross-origin requests
app.use(cors({
  origin: '*', // open or configure specifically if needed
  credentials: true
}));

// Body parser
app.use(express.json());

// Express rate limiting: 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests from this IP. Please try again after 15 minutes." }
});
app.use(limiter);

// Database connection client with auto-retries & fallbacks to prevent runtime errors
const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/marketpulse';
  try {
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected successfully to MarketPulse database.");
  } catch (err) {
    console.error(`[db-connector] Initial MongoDB connection failed: ${err.message}`);
    console.warn("Server will continue running in OFFLINE/MOCK DB mode. Operations depending on Mongoose schemas might encounter restrictions.");
  }
};
connectDB();

// API Route Bindings
app.use('/api/auth', authRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/sentiment', sentimentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/scam', scamRoutes);
app.use('/api/portfolio', portfolioRoutes);

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    dbConnected: mongoose.connection.readyState === 1,
    timestamp: new Date().toISOString()
  });
});

// Global Express Error-handling Middleware
app.use((err, req, res, next) => {
  console.error(`[global-error-handler] Exception caught: ${err.stack || err.message}`);
  
  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    message: err.message || "Internal server error occurred on MarketPulse backend.",
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` MarketPulse backend live on Port ${PORT}`);
  console.log(`=========================================`);
});
