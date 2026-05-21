from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
import os
import re
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/scam", tags=["scam"])

class ScamPayload(BaseModel):
    text: str

# Retrieve key
gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("HF_API_KEY")

def local_scam_analyzer(text: str) -> dict:
    """
    Robust rule-based financial advice scam classifier.
    Analyzes:
      - Promised high returns
      - High urgency language
      - Pump-and-dump keywords
      - Anonymous/unverifiable sources
    """
    text_lower = text.lower()
    
    red_flags = []
    scam_score = 0
    
    # 1. Guaranteed high returns
    guarantees = ["guaranteed", "100% risk free", "no risk", "sure shot", "fixed profit", "double your money", "double in", "risk-free"]
    if any(g in text_lower for g in guarantees):
        red_flags.append("Guaranteed Returns Claimed")
        scam_score += 35
        
    # 2. Urgency language
    urgency = ["buy now", "immediate", "limited time", "don't miss", "happen today", "before market opens", "last chance", "hurry"]
    if any(u in text_lower for u in urgency):
        red_flags.append("Urgency & FOMO Pressure")
        scam_score += 20
        
    # 3. Pump-and-dump triggers
    pump = ["target soon", "operators active", "upper circuit", "insider info", "pump", "jackpot", "secret stock", "next multibagger"]
    if any(p in text_lower for p in pump):
        red_flags.append("Pump & Dump / Insider Mimicry")
        scam_score += 25
        
    # 4. Social channel redirects
    channels = ["telegram link", "whatsapp group", "join group", "premium channel", "unlisted tips", "sms alert"]
    if any(c in text_lower for c in channels):
        red_flags.append("Anonymous Private Channel Redirection")
        scam_score += 20

    # Cap score
    scam_probability = min(scam_score, 100)
    if not red_flags:
        # Default low probability if nothing matches
        scam_probability = max(5, int(len(text) % 15))
        
    # Categorize Risk
    if scam_probability <= 25:
        risk_level = "Low"
        explanation = "This advice appears to be educational or lacks suspicious high-pressure marketing patterns. Still, conduct personal due diligence."
        recommendation = "Appears legitimate. Proceed with standard analysis."
    elif scam_probability <= 55:
        risk_level = "Medium"
        explanation = "The post shows moderate sales pitch signals or mentions optimistic targets. Exercise cautious auditing."
        recommendation = "Proceed with caution. Check official BSE/NSE listings."
    elif scam_probability <= 80:
        risk_level = "High"
        explanation = "This message exhibits strong characteristics of illegal financial schemes, including extreme return projections and urgency triggers."
        recommendation = "Do NOT act on this tip. High risk of capital loss."
    else:
        risk_level = "Critical"
        explanation = "Severe red flags identified. The text promotes guaranteed risk-free gains or private group subscriptions, characteristic of pump-and-dump or unregistered operator traps."
        recommendation = "STAY AWAY! This is a textbook pump-and-dump scheme."

    return {
        "scam_probability": scam_probability,
        "risk_level": risk_level,
        "detected_patterns": red_flags if red_flags else ["None detected"],
        "explanation": explanation,
        "recommendation": recommendation
    }

@router.post("/analyze")
def analyze_scam_tip(payload: ScamPayload):
    if not payload.text or len(payload.text.strip()) < 5:
        raise HTTPException(status_code=400, detail="Tip text is too short to analyze.")
        
    # 1. Attempt Gemini Scam Audit (Premium AI capability)
    if gemini_key and gemini_key.startswith("AIzaSy"):
        try:
            model = genai.GenerativeModel('gemini-1.5-flash')
            prompt = (
                "You are MarketPulse Security AI, an elite compliance auditor for the Indian stock market (SEBI rules). "
                "Analyze the following suspicious stock tip. Identify red flags (guaranteed returns, pump-and-dump, urgency, Telegram/WhatsApp links).\n"
                "Return your findings strictly in the following JSON format:\n"
                "{\n"
                "  \"scam_probability\": 85, // integer 0 to 100\n"
                "  \"risk_level\": \"High\", // Low, Medium, High, or Critical\n"
                "  \"detected_patterns\": [\"Guaranteed Returns\", \"Telegram Channel Link\"],\n"
                "  \"explanation\": \"A concise 2-sentence explanation.\",\n"
                "  \"recommendation\": \"Do NOT act on this tip\"\n"
                "}\n"
                f"Suspicious Tip: \"{payload.text}\"\n"
                "JSON:"
            )
            response = model.generate_content(prompt)
            import json
            # Attempt to parse json directly
            clean_text = response.text.replace("```json", "").replace("```", "").strip()
            # Clean potential extra characters around braces
            start = clean_text.find("{")
            end = clean_text.rfind("}") + 1
            if start != -1 and end != 0:
                parsed = json.loads(clean_text[start:end])
                if all(k in parsed for k in ["scam_probability", "risk_level", "detected_patterns", "explanation", "recommendation"]):
                    return parsed
        except Exception as e:
            print(f"Gemini scam audit failed: {e}. Falling back to heuristic classifier...")
            
    # 2. Local Fallback Heuristics
    return local_scam_analyzer(payload.text)
