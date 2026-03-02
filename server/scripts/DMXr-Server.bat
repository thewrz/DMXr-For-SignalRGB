@echo off
title DMXr Server
cd /d "%~dp0"

if not exist "node.exe" (
    echo.
    echo  ERROR: node.exe not found.
    echo  Re-download from: https://github.com/thewrz/DMXr/releases/latest
    echo.
    pause
    exit /b 1
)

if not exist "dist\index.js" (
    echo.
    echo  ERROR: dist\index.js not found. The zip may be incomplete.
    echo  Re-download from: https://github.com/thewrz/DMXr/releases/latest
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo.
    echo  ERROR: node_modules not found. The zip may be incomplete.
    echo  Re-download from: https://github.com/thewrz/DMXr/releases/latest
    echo.
    pause
    exit /b 1
)

set HOST=0.0.0.0

echo.
echo  DMXr Server starting...
echo  Web Manager: http://localhost:8080
echo  Press Ctrl+C to stop.
echo.

:start
node.exe dist\index.js
echo.
echo  Server exited. Restarting in 3 seconds...
echo  Press Ctrl+C to quit.
timeout /t 3 /nobreak >nul
goto start
