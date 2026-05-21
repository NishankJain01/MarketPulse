import os
import socket
# Set 3.5s default network socket timeout to prevent uvicorn threads hanging on slow APIs
socket.setdefaulttimeout(3.5)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import uvicorn

# Load Environment variables
load_dotenv()

# Import routers
from routers import stocks, sentiment, scam, chat

app = FastAPI(
    title="MarketPulse AI NLP Engine",
    description="Python FastAPI NLP, Sentiment, and Technical Analysis Engine for Indian Stock Markets",
    version="1.0.0"
)

# Enable CORS for cross-service Node communication and client direct queries
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(stocks.router)
app.include_router(sentiment.router)
app.include_router(scam.router)
app.include_router(chat.router)

@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "service": "MarketPulse AI Core",
        "version": "1.0.0",
        "apis": [
            "/stocks/quote",
            "/stocks/chart",
            "/sentiment/analyze",
            "/sentiment/analyze/batch",
            "/sentiment/mood",
            "/sentiment/emotions",
            "/scam/analyze",
            "/chat"
        ]
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
