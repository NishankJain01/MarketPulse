from fastapi import APIRouter, HTTPException, Query
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime
import concurrent.futures

router = APIRouter(prefix="/stocks", tags=["stocks"])

# Static lookup for high-fidelity stock name resolution without slow scraping
TICKER_NAMES = {
    "TCS.NS": "Tata Consultancy Services Ltd",
    "RELIANCE.NS": "Reliance Industries Ltd",
    "INFY.NS": "Infosys Ltd",
    "HDFCBANK.NS": "HDFC Bank Ltd",
    "ICICIBANK.NS": "ICICI Bank Ltd",
    "SBIN.NS": "State Bank of India",
    "BHARTIAIRTEL.NS": "Bharti Airtel Ltd",
    "ITC.NS": "ITC Ltd",
    "^NSEI": "NIFTY 50",
    "^BSESN": "SENSEX",
    "TSLA": "Tesla, Inc.",
    "AAPL": "Apple Inc.",
    "NVDA": "NVIDIA Corporation",
    "MSFT": "Microsoft Corporation",
    "PLTR": "Palantir Technologies Inc.",
    "AMD": "Advanced Micro Devices",
    "SMCI": "Super Micro Computer Inc.",
    "META": "Meta Platforms, Inc.",
    "NFLX": "Netflix, Inc."
}

def run_with_timeout(func, timeout, *args, **kwargs):
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(func, *args, **kwargs)
        try:
            return future.result(timeout=timeout)
        except concurrent.futures.TimeoutError:
            print(f"Operation timed out after {timeout}s in stocks service")
            raise TimeoutError("Timeout exceeded")

def fetch_fast_info_inner(symbol: str) -> dict:
    ticker = yf.Ticker(symbol)
    info = ticker.fast_info
    
    price = info.last_price
    prev_close = info.previous_close
    change = price - prev_close
    change_pct = (change / prev_close) * 100 if prev_close else 0.0
    
    name = TICKER_NAMES.get(symbol.upper(), f"{symbol.upper().split('.')[0]} Corp")
    market_cap = 0
    try:
        market_cap = info.market_cap
    except Exception:
        pass
        
    high_52w = price
    try:
        high_52w = info.year_high or price
    except Exception:
        pass
        
    low_52w = price
    try:
        low_52w = info.year_low or price
    except Exception:
        pass
        
    return {
        "symbol": symbol,
        "name": name,
        "price": float(price),
        "change": float(change),
        "changePct": float(change_pct),
        "marketCap": int(market_cap) if market_cap else None,
        "peRatio": None,
        "high52W": float(high_52w),
        "low52W": float(low_52w)
    }

def get_mock_stock_stats(symbol: str) -> dict:
    symbol_upper = symbol.upper()
    
    # Hash calculation to generate deterministic high-fidelity mock data
    hash_val = 0
    for char in symbol_upper:
        hash_val = ord(char) + ((hash_val << 5) - hash_val)
    
    is_up = hash_val % 2 == 0
    base_price = abs((hash_val % 800) + 50)
    # Give some realistic index pricing if nifty/sensex
    if symbol_upper == "^NSEI":
        base_price = 22350.90
    elif symbol_upper == "^BSESN":
        base_price = 73520.40
        
    change_val = ((hash_val % 30) / 10) + 0.1
    change_pct_val = (change_val / base_price) * 100
    
    final_price = round(base_price, 2)
    final_change = round(change_val if is_up else -change_val, 2)
    final_change_pct = round(change_pct_val if is_up else -change_pct_val, 2)
    
    return {
        "symbol": symbol,
        "name": TICKER_NAMES.get(symbol_upper, f"{symbol_upper.split('.')[0]} Corp"),
        "price": final_price,
        "change": final_change,
        "changePct": final_change_pct,
        "marketCap": int(abs(hash_val % 1000) * 1000000000),
        "peRatio": round(abs(hash_val % 45) + 12, 1),
        "high52W": round(final_price * 1.25, 2),
        "low52W": round(final_price * 0.75, 2)
    }

@router.get("/quote")
def get_stock_quote(symbol: str = Query(..., description="Stock symbol, e.g. RELIANCE.NS")):
    try:
        # Wrap fetching yfinance data with a strict 2.0s timeout
        try:
            data = run_with_timeout(fetch_fast_info_inner, 2.0, symbol)
            return {
                **data,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            print(f"yfinance quote timed out or failed for {symbol}: {e}. Trying history fallback...")
            # Fallback if fast_info fails, grab history with a 2.0s timeout
            ticker = yf.Ticker(symbol)
            def fetch_history_inner():
                return ticker.history(period="2d")
            
            hist = run_with_timeout(fetch_history_inner, 2.0)
            if hist.empty:
                raise ValueError("Empty history returned")
            price = hist['Close'].iloc[-1]
            prev_close = hist['Close'].iloc[-2] if len(hist) > 1 else price
            change = price - prev_close
            change_pct = (change / prev_close) * 100
            
            return {
                "symbol": symbol,
                "name": TICKER_NAMES.get(symbol.upper(), f"{symbol.upper().split('.')[0]} Corp"),
                "price": float(price),
                "change": float(change),
                "changePct": float(change_pct),
                "marketCap": None,
                "peRatio": None,
                "high52W": float(price),
                "low52W": float(price),
                "timestamp": datetime.now().isoformat()
            }
    except Exception as e:
        print(f"All yfinance quote fallbacks failed for {symbol}: {e}. Returning high-fidelity mock quote.")
        mock_data = get_mock_stock_stats(symbol)
        return {
            **mock_data,
            "timestamp": datetime.now().isoformat(),
            "isFallback": True
        }


@router.get("/chart")
def get_chart_data(
    symbol: str = Query(..., description="Stock symbol, e.g. ^NSEI"),
    period: str = Query("1mo", description="yfinance period: 1d, 5d, 1mo, 3mo, 6mo, 1y, 5y"),
    interval: str = Query("1d", description="yfinance interval: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo")
):
    try:
        ticker = yf.Ticker(symbol)
        
        def download_chart_inner():
            return ticker.history(period=period, interval=interval)
            
        df = run_with_timeout(download_chart_inner, 2.5)
        
        if df.empty:
            raise HTTPException(status_code=404, detail=f"No chart data found for symbol '{symbol}'")
            
        df = df.reset_index()
        
        # Standardize date column names depending on format
        if 'Date' in df.columns:
            df['timestamp'] = df['Date'].apply(lambda x: x.isoformat())
        elif 'Datetime' in df.columns:
            df['timestamp'] = df['Datetime'].apply(lambda x: x.isoformat())
        else:
            df['timestamp'] = df.index.map(lambda x: str(x))
            
        # Standardize OHLCV
        df = df.rename(columns={
            'Open': 'open',
            'High': 'high',
            'Low': 'low',
            'Close': 'close',
            'Volume': 'volume'
        })
        
        # Technical Indicator Overlays
        # 1. Simple Moving Averages
        df['sma20'] = df['close'].rolling(window=20).mean()
        df['sma50'] = df['close'].rolling(window=50).mean()
        
        # 2. Exponential Moving Average
        df['ema9'] = df['close'].ewm(span=9, adjust=False).mean()
        
        # 3. Bollinger Bands (20-day, 2 standard dev)
        rstd = df['close'].rolling(window=20).std()
        df['bb_upper'] = df['sma20'] + (rstd * 2)
        df['bb_lower'] = df['sma20'] - (rstd * 2)
        
        # 4. Relative Strength Index (RSI - 14-day)
        delta = df['close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        df['rsi'] = 100 - (100 / (1 + rs))
        
        # 5. MACD (12-day EMA, 26-day EMA, 9-day Signal)
        ema12 = df['close'].ewm(span=12, adjust=False).mean()
        ema26 = df['close'].ewm(span=26, adjust=False).mean()
        df['macd_line'] = ema12 - ema26
        df['macd_signal'] = df['macd_line'].ewm(span=9, adjust=False).mean()
        df['macd_hist'] = df['macd_line'] - df['macd_signal']

        # Replace NaN with None for JSON serialization
        df = df.replace({np.nan: None})
        
        records = df[['timestamp', 'open', 'high', 'low', 'close', 'volume', 
                     'sma20', 'sma50', 'ema9', 'bb_upper', 'bb_lower', 
                     'rsi', 'macd_line', 'macd_signal', 'macd_hist']].to_dict('records')
                     
        return {
            "symbol": symbol,
            "period": period,
            "interval": interval,
            "data": records
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error downloading chart data: {str(e)}")
