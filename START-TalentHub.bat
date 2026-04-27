@echo off
setlocal

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo =====================================
echo   TalentHub One-Click Launcher
echo =====================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%quick-start.ps1"
if errorlevel 1 (
  echo.
  echo [ERROR] Quick start failed. Check .runtime-logs for details.
  pause
  exit /b 1
)

echo.
echo [DONE] Platform started successfully.
pause
