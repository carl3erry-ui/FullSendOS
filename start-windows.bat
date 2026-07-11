@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Consulting OS

echo ========================================
echo        CONSULTING OS - STARTUP
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not available in PATH.
  echo Install Node.js 20 or newer, then restart Windows.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm is not available in PATH.
  echo Reinstall Node.js with npm enabled.
  pause
  exit /b 1
)

echo Node:
node --version
echo npm:
npm --version
echo.

REM Repair the common Windows filename mistake.
if not exist ".env" if exist ".env.env" (
  ren ".env.env" ".env"
  echo Renamed .env.env to .env.
)

if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  echo Created .env.
  echo Open .env in Notepad and add your xAI API key.
  notepad ".env"
  echo After saving .env, return here and press any key.
  pause >nul
)

if not exist "node_modules\express\package.json" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo.
    echo ERROR: npm install failed.
    pause
    exit /b 1
  )
)

echo.
echo Starting the server in this window...
echo Keep this window open while using Consulting OS.
echo Open http://localhost:3000 in your browser.
echo.
start "" "http://localhost:3000"
call npm start

echo.
echo The server stopped. Review the error above.
pause
