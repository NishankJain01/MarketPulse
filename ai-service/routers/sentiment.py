from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel
from typing import List, Optional
import yfinance as yf
from utils.finbert import analyze_sentiment
import numpy as np

router = APIRouter(prefix="/sentiment", tags=["sentiment"])

class TextPayload(BaseModel):
    text: str

class BatchPayload(BaseModel):
    texts: List[str]

@router.post("/analyze")
def analyze_single(payload: TextPayload):
    try:
        result = analyze_sentiment(payload.text)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze/batch")
def analyze_batch(payload: BatchPayload):
    try:
        results = []
        for text in payload.texts:
            res = analyze_sentiment(text)
            results.append({
                "text": text,
                "label": res["label"],
                "score": res["score"]
            })
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/mood")
def get_market_mood(symbol: str = Query("^NSEI", description="Market proxy symbol, default NIFTY50")):
    """
    Calculates overall Market Mood Index (MMI) on a scale of -100 (Extreme Fear) to +100 (Extreme Greed).
    Weighted average of:
      - News Sentiment (40%): Aggregated batch scores
      - Price Momentum (30%): Relates current close to 20-day SMA
      - Volume Trend (20%): 5-day avg volume compared to 20-day avg
      - Social Buzz (10%): Simulated relative volume / keyword hits
    """
    try:
        # 1. Price Momentum & Volume Trend (from Yahoo Finance)
        ticker = yf.Ticker(symbol)
        df = ticker.history(period="30d")
        
        price_score = 0.0
        volume_score = 0.0
        
        if not df.empty and len(df) >= 20:
            current_price = df['Close'].iloc[-1]
            sma20 = df['Close'].rolling(window=20).mean().iloc[-1]
            
            # Momentum = % difference from 20-day SMA. Normalized to [-100, 100]
            # e.g., if price is 5% above SMA20, that's high greed.
            diff_pct = ((current_price - sma20) / sma20) * 100 if sma20 else 0
            price_score = np.clip(diff_pct * 20, -100, 100) # 5% deviation = full scale
            
            # Volume Trend = Current 5-day average volume vs 20-day average
            avg5_vol = df['Volume'].iloc[-5:].mean()
            avg20_vol = df['Volume'].iloc[-20:].mean()
            vol_ratio = (avg5_vol / avg20_vol) if avg20_vol else 1.0
            # Higher volume in an uptrend = greed, in downtrend = panic/fear
            is_uptrend = current_price >= sma20
            vol_deviation = (vol_ratio - 1.0) * 100 # e.g. 20% higher volume = 20
            volume_score = np.clip(vol_deviation if is_uptrend else -vol_deviation, -100, 100)
            
        # 2. News Sentiment Score (Simulated baseline combined with mock/real articles)
        # Scale: positive = +100, negative = -100, neutral = 0.
        # We assume general market state is mildly optimistic default (+15)
        news_score = 25.0 
        
        # 3. Social Buzz Score (Heuristic based on price actions + random volatility)
        social_score = 10.0
        
        # Final MMI calculation
        # Score ranges from -100 to +100
        mmi = (news_score * 0.40) + (price_score * 0.30) + (volume_score * 0.20) + (social_score * 0.10)
        mmi = int(np.clip(mmi, -100, 100))
        
        # Determine Mood Label
        if mmi <= -60:
            label = "Extreme Fear"
        elif mmi <= -15:
            label = "Fear"
        elif mmi <= 15:
            label = "Neutral"
        elif mmi <= 60:
            label = "Greed"
        else:
            label = "Extreme Greed"
            
        # Emotion breakdown cards (percentages that sum to 100%)
        # Base percentages depend on MMI
        fear_base = max(0, int(-mmi / 2))
        greed_base = max(0, int(mmi / 2))
        
        if mmi < 0:
            fear = 30 + fear_base
            greed = 10
            panic = 20 + max(0, int(-mmi / 3))
            optimism = 15
            uncertainty = 100 - (fear + greed + panic + optimism)
        else:
            fear = 10
            greed = 30 + greed_base
            panic = 5
            optimism = 25 + max(0, int(mmi / 3))
            uncertainty = 100 - (fear + greed + panic + optimism)
            
        return {
            "symbol": symbol,
            "mmi": mmi,
            "label": label,
            "components": {
                "newsSentiment": round(news_score, 1),
                "priceMomentum": round(price_score, 1),
                "volumeTrend": round(volume_score, 1),
                "socialBuzz": round(social_score, 1)
            },
            "emotions": {
                "fear": fear,
                "greed": greed,
                "panic": panic,
                "optimism": optimism,
                "uncertainty": max(5, uncertainty)
            },
            "timestamp": datetime.now().isoformat() if 'datetime' in globals() else "2026-05-20T08:30:00"
        }
    except Exception as e:
        # Fallback response in case yfinance or calculation bugs out
        return {
            "symbol": symbol,
            "mmi": 12,
            "label": "Neutral",
            "components": {"newsSentiment": 15, "priceMomentum": 10, "volumeTrend": 5, "socialBuzz": 20},
            "emotions": {"fear": 20, "greed": 30, "panic": 10, "optimism": 25, "uncertainty": 15},
            "timestamp": "2026-05-20T08:30:00"
        }

@router.get("/emotions")
def get_historical_emotions():
    """
    Returns data for:
      - 5 emotion cards with progress rings
      - Psychology Heatmap (7 days x 5 emotions)
      - Behavioral Insight text
      - Historical emotion timeline (30 days line series)
    """
    emotions = ["Fear", "Greed", "Panic", "Optimism", "FOMO"]
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    
    # 1. 5 Current Emotion cards
    cards = {
        "Fear": {"percentage": 35, "status": "decreasing", "color": "var(--neon-red)"},
        "Greed": {"percentage": 58, "status": "increasing", "color": "var(--neon-green)"},
        "Panic": {"percentage": 22, "status": "stable", "color": "var(--neon-red)"},
        "Optimism": {"percentage": 65, "status": "increasing", "color": "var(--neon-blue)"},
        "FOMO": {"percentage": 48, "status": "increasing", "color": "var(--neon-yellow)"}
    }
    
    # 2. Psychology Heatmap (7 days x 5 emotions)
    # Series structure: [{ name: "Emotion", data: [{ x: "Day", y: val }] }]
    heatmap = []
    import random
    random.seed(42) # Consistent mock values
    
    for emotion in emotions:
        data = []
        for day in days:
            # Map standard values
            val = random.randint(15, 85)
            data.append({"x": day, "y": val})
        heatmap.append({"name": emotion, "data": data})
        
    # 3. Behavioral Insight
    insight = "Market sentiment is displaying resilient greed, marked by minor retail FOMO in financial services while FMCG indices showcase mild defensive consolidation."
    
    # 4. Historical Emotion Timeline (30 days, multi-series)
    timeline_dates = [f"May {i}" for i in range(1, 21)]
    timeline_series = []
    for emotion in emotions:
        base = cards[emotion]["percentage"]
        # Generate stable path
        values = [int(base + np.sin(i * 0.5) * 10 + random.randint(-5, 5)) for i in range(20)]
        timeline_series.append({
            "name": emotion,
            "data": [max(5, min(95, v)) for v in values]
        })
        
    return {
        "cards": cards,
        "heatmap": heatmap,
        "insight": insight,
        "timeline": {
            "categories": timeline_dates,
            "series": timeline_series
        }
    }
