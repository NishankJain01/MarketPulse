import express from 'express';
import axios from 'axios';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';

// In-memory cache for overview data
let overviewCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 30000; // 30 seconds

const DEFAULT_SYMBOLS = [
  '^NSEI', // Nifty 50
  '^BSESN', // SENSEX
  'RELIANCE.NS',
  'TCS.NS',
  'INFY.NS',
  'HDFCBANK.NS',
  'ICICIBANK.NS'
];

const mockQuotes = {
  '^NSEI': { symbol: '^NSEI', name: 'NIFTY 50', price: 22350.90, change: 145.30, changePct: 0.65 },
  '^BSESN': { symbol: '^BSESN', name: 'SENSEX', price: 73520.40, change: 480.10, changePct: 0.66 },
  'RELIANCE.NS': { symbol: 'RELIANCE.NS', name: 'Reliance Industries Limited', price: 2855.20, change: 35.40, changePct: 1.26 },
  'TCS.NS': { symbol: 'TCS.NS', name: 'Tata Consultancy Services Limited', price: 3880.60, change: -42.15, changePct: -1.07 },
  'INFY.NS': { symbol: 'INFY.NS', name: 'Infosys Limited', price: 1435.50, change: -12.30, changePct: -0.85 },
  'HDFCBANK.NS': { symbol: 'HDFCBANK.NS', name: 'HDFC Bank Limited', price: 1485.40, change: 8.90, changePct: 0.60 },
  'ICICIBANK.NS': { symbol: 'ICICIBANK.NS', name: 'ICICI Bank Limited', price: 1120.15, change: 18.25, changePct: 1.66 }
};

// GET /api/stocks/overview
router.get('/overview', async (req, res, next) => {
  try {
    const now = Date.now();
    if (overviewCache && (now - cacheTimestamp < CACHE_DURATION)) {
      return res.json({ ...overviewCache, source: 'cache' });
    }

    const quotes = [];
    const fetchPromises = DEFAULT_SYMBOLS.map(async (symbol) => {
      try {
        const response = await axios.get(`${AI_SERVICE_URL}/stocks/quote?symbol=${symbol}`, { timeout: 4000 });
        return response.data;
      } catch (err) {
        console.error(`[stocks-overview] Error fetching ${symbol} from AI service, using mock/fallback: ${err.message}`);
        // Return realistic mock quote instead of crashing
        const mock = mockQuotes[symbol] || { symbol, name: symbol, price: 100.0, change: 0.0, changePct: 0.0 };
        return {
          ...mock,
          timestamp: new Date().isoformat ? new Date().isoformat() : new Date().toISOString(),
          isFallback: true
        };
      }
    });

    const results = await Promise.all(fetchPromises);
    
    // Sort into Indices vs Equities
    const indices = results.filter(q => q.symbol.startsWith('^'));
    const equities = results.filter(q => !q.symbol.startsWith('^'));

    // Market status based on IST 9:15 to 15:30 (Mon-Fri)
    const checkMarketOpen = () => {
      // Current system time converted to IST
      const utcTime = new Date();
      // UTC to IST (+5:30)
      const istTime = new Date(utcTime.getTime() + (5.5 * 60 * 60 * 1000));
      const day = istTime.getUTCDay(); // 0 is Sunday, 6 is Saturday
      const hour = istTime.getUTCHours();
      const min = istTime.getUTCMinutes();
      
      const isWeekDay = day >= 1 && day <= 5;
      const totalMinutes = (hour * 60) + min;
      const openMinutes = (9 * 60) + 15;
      const closeMinutes = (15 * 60) + 30;
      
      return isWeekDay && (totalMinutes >= openMinutes && totalMinutes <= closeMinutes);
    };

    const isOpen = checkMarketOpen();

    // Technical sorting for gainers/losers
    const equitiesSorted = [...equities].sort((a, b) => b.changePct - a.changePct);
    const topGainers = equitiesSorted.slice(0, 3);
    const topLosers = [...equitiesSorted].reverse().slice(0, 3);

    overviewCache = {
      indices,
      equities,
      topGainers,
      topLosers,
      marketOpen: isOpen,
      timestamp: new Date().toISOString()
    };
    cacheTimestamp = now;

    return res.json({ ...overviewCache, source: 'live' });
  } catch (error) {
    next(error);
  }
});

// GET /api/stocks/chart/:symbol
router.get('/chart/:symbol', async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const period = req.query.period || '1mo';
    const interval = req.query.interval || '1d';

    try {
      const response = await axios.get(
        `${AI_SERVICE_URL}/stocks/chart?symbol=${symbol}&period=${period}&interval=${interval}`,
        { timeout: 8000 }
      );
      
      // Also grab dynamic FinBERT/Gemini sentiment badge for this symbol
      let sentiment = { label: "neutral", score: 0.75 };
      try {
        const sentimentResponse = await axios.post(`${AI_SERVICE_URL}/sentiment/analyze`, {
          text: `Performance and outlook for ${symbol} stock price movements.`
        }, { timeout: 3000 });
        sentiment = sentimentResponse.data;
      } catch (e) {
        // Safe skip
      }
      
      return res.json({
        ...response.data,
        sentiment
      });
    } catch (err) {
      console.error(`[stocks-chart] yfinance chart download failed for ${symbol}: ${err.message}`);
      return res.status(404).json({
        message: `Stock chart data for '${symbol}' is not available at the moment.`,
        error: err.message
      });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
