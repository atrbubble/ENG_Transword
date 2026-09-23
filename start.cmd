@echo off
cd /d "%~dp0"
echo Starting Transword Archive...
echo The browser will open automatically at http://localhost:5173/ENG_Transword/
echo Close this window to stop the server.
echo.
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:5173/ENG_Transword/"
call npm run dev
