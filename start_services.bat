@echo off
title MarketPulse Services Orchestrator
echo ===================================================
echo  Starting all MarketPulse services in new windows...
echo ===================================================

echo Starting AI Service...
start "MarketPulse AI Service" cmd /k "cd /d C:\Users\nishank\Desktop\MarketPulse\ai-service && pip install -r requirements.txt && python main.py"

echo Starting Backend Server...
start "MarketPulse Backend Server" cmd /k "cd /d C:\Users\nishank\Desktop\MarketPulse\server && npm run dev"

echo Starting React Client...
start "MarketPulse React Client" cmd /k "cd /d C:\Users\nishank\Desktop\MarketPulse\client && npm run dev"

echo All services launched! Check the newly opened windows.
pause
