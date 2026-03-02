@echo off
TITLE QuoteGenerator Server
echo ===================================================
echo Starting QuoteGenerator Local Server (server.py)...
echo ===================================================
cd /d "%~dp0"
python server.py
pause
