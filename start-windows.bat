@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title FullSendOS Next.js

echo ========================================
echo        FULLSENDOS - NEXT.JS STARTUP
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed.
  echo Install Node.js 20.9 or newer and try again.
  pause
  exit /b 1
)

if not exist ".env.local" (
  copy /y ".env.example" ".env.local" >nul
  echo Created .env.local.
  echo Add your xAI key, save, and close Notepad.
  notepad ".env.local"
  pause
)

echo Installing dependencies...
call npm install
if errorlevel 1 (
  echo ERROR: npm install failed.
  pause
  exit /b 1
)

echo Building FullSendOS...
call npm run build
if errorlevel 1 (
  echo ERROR: The Next.js build failed. Review the message above.
  pause
  exit /b 1
)

echo Starting FullSendOS...
start "FullSendOS Server" cmd /k "cd /d ""%~dp0"" && npm start"

echo Waiting for the server...
powershell -NoProfile -Command "$ok=$false; 1..40 | %% { try { $r=Invoke-WebRequest 'http://localhost:3000/api/health' -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -eq 200){$ok=$true;break} } catch {}; Start-Sleep 1 }; if(-not $ok){exit 1}"
if errorlevel 1 (
  echo ERROR: Server did not become ready. Check the FullSendOS Server window.
  pause
  exit /b 1
)

start "" "http://localhost:3000"
echo FullSendOS is running. Keep the server window open.
pause
