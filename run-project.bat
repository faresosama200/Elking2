@echo off
setlocal

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo =====================================
echo   TalentHub Quick Run
echo =====================================
echo.
echo Starting backend API on http://localhost:4000 ...
start "TalentHub API" cmd /k "cd /d ""%ROOT%"" && npm run dev:api"

echo Starting frontend server on http://127.0.0.1:5500 ...
start "TalentHub Frontend" cmd /k "cd /d ""%ROOT%"" && npx --yes http-server@14.1.1 -p 5500 -c-1"

echo Waiting a few seconds before opening browser...
timeout /t 4 /nobreak >nul

start "" "http://127.0.0.1:5500/login/login.html"

echo.
echo Project started. Keep the opened terminal windows running.
echo To stop the project, close the "TalentHub API" and "TalentHub Frontend" windows.
echo.
pause
