@echo off
cd /d "%~dp0"
echo Starting Transword Archive...
echo After start, open http://localhost:5173/ENG_Transword/ in your browser.
echo Close this window to stop the server.
echo.
call npm run dev
