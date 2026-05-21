import axios from 'axios';

console.log("=========================================");
console.log(" Starting MarketPulse Services Audit...  ");
console.log("=========================================\n");

const API_SERVER = 'http://localhost:5000/api';
const AI_SERVER = 'http://localhost:8000';

async function audit() {
  console.log("1. Checking Python FastAPI NLP Service status...");
  try {
    const res = await axios.get(`${AI_SERVER}/`);
    console.log("   ✅ FastAPI Online. Healthy APIs: ", res.data.apis.join(', '));
  } catch (err) {
    console.log("   ❌ FastAPI Offline. Start via: cd ai-service && python main.py");
  }

  console.log("\n2. Auditing yfinance stock quotes & technical chart wrappers...");
  try {
    const quoteRes = await axios.get(`${AI_SERVER}/stocks/quote?symbol=RELIANCE.NS`);
    console.log(`   ✅ Reliance LTP: ₹${quoteRes.data.price} (${quoteRes.data.changePct.toFixed(2)}%)`);
    
    const chartRes = await axios.get(`${AI_SERVER}/stocks/chart?symbol=^NSEI&period=1mo`);
    console.log(`   ✅ Nifty 50 Chart loaded. ${chartRes.data.data.length} candlesticks returned with indicators (RSI, EMA).`);
  } catch (err) {
    console.log("   ❌ Stock service check failed: ", err.message);
  }

  console.log("\n3. Testing Google Gemini / FinBERT Sentiment & Scam Classifiers...");
  try {
    const sentimentRes = await axios.post(`${AI_SERVER}/sentiment/analyze`, {
      text: "Nifty rallies past 22,400 as domestic demand surges."
    });
    console.log(`   ✅ Sentiment: ${sentimentRes.data.label} (Score: ${sentimentRes.data.score})`);

    const scamRes = await axios.post(`${AI_SERVER}/scam/analyze`, {
      text: "Insiders pump RELIANCE! 300% guaranteed target join whatsapp tips group!"
    });
    console.log(`   ✅ Scam Probability: ${scamRes.data.scam_probability}% (Risk: ${scamRes.data.risk_level})`);
  } catch (err) {
    console.log("   ❌ AI Model check failed: ", err.message);
  }

  console.log("\n4. Checking Node.js Express server connection...");
  try {
    const res = await axios.get('http://localhost:5000/health');
    console.log(`   ✅ Express Online. Database Connected: ${res.data.dbConnected}`);
  } catch (err) {
    console.log("   ❌ Express Server Offline. Start via: cd server && npm start");
  }
}

audit();
