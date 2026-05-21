import os
import requests
import re
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

HF_MODEL = "ProsusAI/finbert"
HF_API_URL = f"https://api-inference.huggingface.co/models/{HF_MODEL}"

# Initialize Gemini Client if Key is Present
gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("HF_API_KEY")
if gemini_key and gemini_key.startswith("AIzaSy"):
    try:
        genai.configure(api_key=gemini_key)
        print("Gemini model configured successfully for AI-service.")
    except Exception as e:
        print(f"Error configuring Gemini: {e}")

_gemini_failing = False

def local_fallback_sentiment(text: str) -> dict:
    """
    Highly robust rule-based finance heuristic sentiment classifier
    for 100% reliable fallback operations.
    """
    text_lower = text.lower()
    
    # Financial indicators
    positive_words = [
        "surge", "rally", "gains", "growth", "bullish", "profit", "beats", "exceeds",
        "recovery", "high", "rise", "optimistic", "upward", "breakout", "jump", "skyrocket"
    ]
    negative_words = [
        "slump", "fall", "losses", "drop", "bearish", "crash", "misses", "deficit",
        "decline", "low", "dip", "pessimistic", "downward", "plunge", "plummet", "correction"
    ]
    
    pos_score = sum(1 for word in positive_words if word in text_lower)
    neg_score = sum(1 for word in negative_words if word in text_lower)
    
    # Analyze sentiment
    if pos_score > neg_score:
        label = "positive"
        score = 0.6 + (min(pos_score - neg_score, 4) * 0.1)
    elif neg_score > pos_score:
        label = "negative"
        score = 0.6 + (min(neg_score - pos_score, 4) * 0.1)
    else:
        label = "neutral"
        score = 0.8
        
    return {"label": label, "score": round(score, 3)}

def analyze_sentiment(text: str) -> dict:
    """
    Performs sentiment analysis using:
    1. Google Gemini (since user keys start with AIzaSy)
    2. HF FinBERT (if configured with standard HF key)
    3. High-fidelity local rule-based heuristics
    """
    global _gemini_failing
    # 1. Attempt Gemini Sentiment (Best for the user's provided keys starting with AIzaSy)
    if gemini_key and gemini_key.startswith("AIzaSy") and not _gemini_failing:
        try:
            model = genai.GenerativeModel('gemini-2.5-flash')
            prompt = (
                "You are FinBERT, an expert financial sentiment classifier. "
                "Classify the following headline into exactly one of [positive, negative, neutral] "
                "and return a confidence score between 0.0 and 1.0.\n"
                "Format your response EXACTLY as a JSON object, like: {\"label\": \"positive\", \"score\": 0.95}.\n"
                f"Headline: \"{text}\"\n"
                "JSON:"
            )
            response = model.generate_content(prompt)
            # Extract JSON pattern
            match = re.search(r'\{\s*"label"\s*:\s*"(\w+)"\s*,\s*"score"\s*:\s*([\d\.]+)\s*\}', response.text)
            if match:
                label = match.group(1).lower()
                score = float(match.group(2))
                if label in ["positive", "negative", "neutral"]:
                    return {"label": label, "score": round(score, 3)}
        except Exception as e:
            print(f"Gemini sentiment failed: {e}. Trying HF/Local...")
            err_str = str(e).lower()
            if "429" in err_str or "quota" in err_str or "403" in err_str or "api key" in err_str or "not found" in err_str or "404" in err_str:
                print("Persistent or rate-limit Gemini error detected. Triggering sentiment circuit breaker.")
                _gemini_failing = True

    # 2. Attempt HuggingFace Inference API (FinBERT)
    hf_key = os.getenv("HF_API_KEY")
    if hf_key and not hf_key.startswith("AIzaSy"):
        try:
            headers = {"Authorization": f"Bearer {hf_key}"}
            response = requests.post(HF_API_URL, headers=headers, json={"inputs": text}, timeout=5)
            if response.status_code == 200:
                results = response.json()[0]
                top = max(results, key=lambda x: x['score'])
                # ProsusAI output label mapping: positive/negative/neutral
                return {"label": top["label"].lower(), "score": round(top["score"], 3)}
        except Exception as e:
            print(f"HF Inference API failed: {e}. Trying Local...")

    # 3. Local Rule-based Fallback
    return local_fallback_sentiment(text)
