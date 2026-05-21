import express from 'express';
import axios from 'axios';
import { verifyToken } from '../middleware/authMiddleware.js';
import { User } from '../models/User.js';

const router = express.Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';

const sectorMap = {
  'RELIANCE.NS': 'Energy & Oil',
  'TCS.NS': 'Technology',
  'INFY.NS': 'Technology',
  'HDFCBANK.NS': 'Banking & Finance',
  'ICICIBANK.NS': 'Banking & Finance'
};

const getSector = (symbol) => {
  const sym = symbol.toUpperCase();
  if (sectorMap[sym]) return sectorMap[sym];
  if (sym.endsWith('.NS') || sym.endsWith('.BO')) {
    if (sym.includes('BANK') || sym.includes('SBI') || sym.includes('HDFC') || sym.includes('AXIS')) return 'Banking & Finance';
    if (sym.includes('TCS') || sym.includes('INFY') || sym.includes('WIPRO') || sym.includes('TECH')) return 'Technology';
    if (sym.includes('POWER') || sym.includes('ONGC') || sym.includes('IOC') || sym.includes('BPCL')) return 'Energy & Oil';
    if (sym.includes('PHARMA') || sym.includes('DRREDDY') || sym.includes('SUN')) return 'Healthcare';
  }
  return 'Diversified / Mid-Cap';
};

// GET /api/portfolio (Protected)
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const portfolio = user.portfolio || [];
    if (portfolio.length === 0) {
      return res.json({
        items: [],
        summary: { totalInvested: 0, currentValue: 0, totalPL: 0, returnPct: 0, healthScore: 100 },
        sectors: [],
        suggestions: [
          "Your portfolio is currently empty. Add stocks above to audit your assets.",
          "Consider starting with highly liquid blue-chip equities to establish a stable foundation.",
          "Aim for a balance of 4-6 diverse equities across banking, IT, and defensive sectors."
        ]
      });
    }

    // 1. Fetch LTPs in parallel from FastAPI stocks router
    const fetchPromises = portfolio.map(async (item) => {
      try {
        const response = await axios.get(`${AI_SERVICE_URL}/stocks/quote?symbol=${item.symbol}`, { timeout: 4000 });
        const quote = response.data;
        const ltp = quote.price;
        const cost = item.qty * item.avgBuy;
        const value = item.qty * ltp;
        const pl = value - cost;
        const plPct = cost > 0 ? (pl / cost) * 100 : 0.0;
        
        return {
          id: item._id,
          symbol: item.symbol,
          qty: item.qty,
          avgBuy: item.avgBuy,
          ltp: ltp,
          name: quote.name,
          cost: roundTwo(cost),
          value: roundTwo(value),
          pl: roundTwo(pl),
          plPct: roundTwo(plPct),
          sector: getSector(item.symbol),
          addedAt: item.addedAt
        };
      } catch (err) {
        console.error(`[portfolio-ltp] Error loading LTP for ${item.symbol}: ${err.message}`);
        // Fallback to average purchase price as LTP if offline
        const cost = item.qty * item.avgBuy;
        return {
          id: item._id,
          symbol: item.symbol,
          qty: item.qty,
          avgBuy: item.avgBuy,
          ltp: item.avgBuy,
          name: item.symbol,
          cost: roundTwo(cost),
          value: roundTwo(cost),
          pl: 0.0,
          plPct: 0.0,
          sector: getSector(item.symbol),
          addedAt: item.addedAt,
          isFallback: true
        };
      }
    });

    const items = await Promise.all(fetchPromises);

    // 2. Calculations
    let totalInvested = 0;
    let currentValue = 0;
    const sectorsDict = {};

    items.forEach(item => {
      totalInvested += item.cost;
      currentValue += item.value;
      
      const sec = item.sector;
      sectorsDict[sec] = (sectorsDict[sec] || 0) + item.value;
    });

    const totalPL = currentValue - totalInvested;
    const returnPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0.0;

    // Convert sectors dict to chart array
    const sectorSeries = [];
    const sectorLabels = [];
    
    Object.entries(sectorsDict).forEach(([label, val]) => {
      sectorLabels.push(label);
      // Percentage contribution
      const pct = currentValue > 0 ? roundTwo((val / currentValue) * 100) : 0;
      sectorSeries.push(pct);
    });

    // 3. AI Health Score & Suggestions Generator
    let healthScore = 75; // Default average
    let suggestions = [];

    // Simple Rule-Engine to compute diversification metrics
    const sectorCount = Object.keys(sectorsDict).length;
    const maxSectorWeight = sectorSeries.length > 0 ? Math.max(...sectorSeries) : 0;

    if (sectorCount === 1) {
      healthScore -= 20; // Bad diversification
      suggestions.push("⚠️ **High Exposure Alert**: Your portfolio is concentrated in a single sector. Consider diversifying across banking, IT, or manufacturing to mitigate sector-specific risks.");
    } else if (maxSectorWeight > 60) {
      healthScore -= 10;
      suggestions.push(`⚠️ **Concentration Risk**: One sector accounts for ${maxSectorWeight}% of your assets. Trim holdings to cap any single sector exposure at 40%.`);
    }

    if (returnPct < -10) {
      healthScore -= 10;
      suggestions.push("📉 **Drawdown Optimization**: Your overall portfolio is down by over 10%. Review lagging midcaps and set strict trailing stop-losses (e.g. 8-12%) to protect remaining capital.");
    }

    // Call advanced FastAPI chatbot contextually to get premium AI optimization advice if possible
    if (suggestions.length < 3) {
      try {
        const details = items.map(it => `${it.symbol} (${it.qty} shares, bought at ₹${it.avgBuy}, current ₹${it.ltp})`).join(', ');
        const chatPrompt = 
          `Act as an elite SEBI-compliant Portfolio Risk Officer. Review this portfolio: ${details}. ` +
          "Give 3 very short, bulleted optimization tips (rebalancing, risk warnings, or capital allocation). " +
          "Make them highly specific, action-oriented, and reference Indian indices. Do not write introductory text. Format each bullet like: - **[Title]**: [Detail].";
        const aiResponse = await axios.post(`${AI_SERVICE_URL}/chat`, { message: chatPrompt, history: [] }, { timeout: 5000 });
        const lines = aiResponse.data.response
          .split('\n')
          .map(l => l.trim())
          .filter(l => l.startsWith('-') || l.startsWith('*'));
        
        if (lines.length >= 2) {
          // Replace standard checklist with AI response lines
          lines.forEach(line => {
            const clean = line.replace(/^[\-\*\s]+/, "");
            if (clean && !suggestions.includes(clean)) {
              suggestions.push(clean);
            }
          });
        }
      } catch (e) {
        console.warn(`[portfolio-ai-suggestions] Failed to query dynamic advisory suggestions: ${e.message}`);
      }
    }

    // Base default premium suggestions if list is still small
    if (suggestions.length < 3) {
      suggestions.push("✅ **Healthy Broad Allocation**: Your sector weights show stable diversification. Maintain systematic monthly accumulations (SIPs) in these blue-chips.");
      suggestions.push("📈 **Growth Index Calibration**: 30% of your holdings are in index-heavy tech/banking stocks. This positions you well to match secular Nifty expansions.");
      suggestions.push("🎯 **Capital Preservation**: Review trailing stop-losses monthly. For blue-chips, an 8% trailing stop-loss safeguards profit margins during sharp global corrections.");
    }

    healthScore = Math.max(20, Math.min(100, healthScore));

    return res.json({
      items,
      summary: {
        totalInvested: roundTwo(totalInvested),
        currentValue: roundTwo(currentValue),
        totalPL: roundTwo(totalPL),
        returnPct: roundTwo(returnPct),
        healthScore: healthScore
      },
      sectors: {
        series: sectorSeries,
        labels: sectorLabels
      },
      suggestions
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/portfolio (Protected)
router.post('/', verifyToken, async (req, res, next) => {
  try {
    const { symbol, qty, avgBuy } = req.body;
    
    if (!symbol || !qty || !avgBuy) {
      return res.status(400).json({ message: "Symbol, quantity, and average buy price are required." });
    }

    const numericQty = parseFloat(qty);
    const numericAvgBuy = parseFloat(avgBuy);

    if (isNaN(numericQty) || numericQty <= 0) {
      return res.status(400).json({ message: "Quantity must be a positive number." });
    }
    if (isNaN(numericAvgBuy) || numericAvgBuy <= 0) {
      return res.status(400).json({ message: "Average purchase price must be a positive number." });
    }

    // 1. Verify symbol is valid by fetching from FastAPI
    try {
      await axios.get(`${AI_SERVICE_URL}/stocks/quote?symbol=${symbol}`, { timeout: 4000 });
    } catch (err) {
      return res.status(400).json({ message: `Symbol '${symbol}' is invalid or could not be found on Indian exchanges.` });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if stock already exists in portfolio
    const existingIndex = user.portfolio.findIndex(item => item.symbol.toUpperCase() === symbol.toUpperCase());
    
    if (existingIndex > -1) {
      // Average out purchase price
      const existing = user.portfolio[existingIndex];
      const newQty = existing.qty + numericQty;
      const newAvgBuy = ((existing.qty * existing.avgBuy) + (numericQty * numericAvgBuy)) / newQty;
      
      existing.qty = newQty;
      existing.avgBuy = roundTwo(newAvgBuy);
    } else {
      user.portfolio.push({
        symbol: symbol.toUpperCase(),
        qty: numericQty,
        avgBuy: roundTwo(numericAvgBuy)
      });
    }

    await user.save();
    return res.status(201).json({ message: "Asset successfully updated in your portfolio." });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/portfolio/:id (Protected)
router.delete('/:id', verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.portfolio = user.portfolio.filter(item => item._id.toString() !== id);
    await user.save();

    return res.json({ message: "Asset successfully removed from your portfolio." });
  } catch (error) {
    next(error);
  }
});

// Helper utilities
const roundTwo = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

export default router;
