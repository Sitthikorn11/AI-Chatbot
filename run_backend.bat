@echo off
cd /d c:\ChatbotICT
echo Starting Backend Server...
python -m uvicorn chatbot_back.main:app --reload
pause
