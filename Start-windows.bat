@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title FullSendOS

echo ========================================
echo            FULLSENDOS STARTUP
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js is not installed.
    echo Install Node.js, restart the computer, and try again.
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo ERROR: npm is not installed or is not available.
    pause
    exit /b 1
)

echo Node version:
node --version

echo npm version:
npm --version
echo.

REM Fix common Windows environment filename mistakes.
if not exist ".env" (
    if exist ".env.env" (
        ren ".env.env" ".env"
        echo Renamed .env.env to .env.
    )
)

if not exist ".env" (
    if not exist ".env.example" (
        echo ERROR: .env.example is missing.
        echo Create a file named .env.example in this folder.
        pause
        exit /b 1
    )

    copy /y ".env.example" ".env" >nul
    echo Created the private .env file.
    echo.
    echo Add your xAI API key in Notepad.
    echo Save and close Notepad when finished.
    echo.
    notepad ".env"
    pause
)

echo Installing and verifying dependencies...
call npm install

if errorlevel 1 (
    echo.
    echo ERROR: npm install failed.
    echo Review the error shown above.
    pause
    exit /b 1
)

echo.
echo Running application test...
call npm test

if errorlevel 1 (
    echo.
    echo ERROR: The application test failed.
    echo Review the error shown above.
    pause
    exit /b 1
)

echo.
echo Starting FullSendOS...
echo Keep this window open while using the application.
echo.

start "FullSendOS Server" cmd /k "cd /d "%~dp0" && npm start"

echo Waiting for the server...

powershell -NoProfile -Command ^
  "$ready = $false; for ($i = 0; $i -lt 30; $i++) { try { $r = Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { $ready = $true; break } } catch {}; Start-Sleep -Seconds 1 }; if (-not $ready) { exit 1 }"

if errorlevel 1 (
    echo.
    echo ERROR: The server did not respond at:
    echo http://localhost:3000/api/health
    echo.
    echo Review the separate FullSendOS Server window.
    pause
    exit /b 1
)

echo.
echo FullSendOS is ready.
start "" "http://localhost:3000"

echo.
echo Your browser should now be open.
echo Keep the FullSendOS Server window open.
pause
