@echo off
title DMXr Service Installer
cd /d "%~dp0"

:: Check for admin privileges
net session >nul 2>&1
if errorlevel 1 (
    echo.
    echo  ERROR: This script must be run as Administrator.
    echo  Right-click and select "Run as administrator".
    echo.
    pause
    exit /b 1
)

:: Validate required files
if not exist "nssm.exe" (
    echo.
    echo  ERROR: nssm.exe not found.
    echo  Re-download from: https://github.com/thewrz/DMXr/releases/latest
    echo.
    pause
    exit /b 1
)

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

set SERVICE_NAME=DMXr
set APP_DIR=%~dp0

echo.
echo  Installing DMXr as Windows service...
echo.

nssm install %SERVICE_NAME% "%APP_DIR%node.exe" "dist\index.js"
nssm set %SERVICE_NAME% AppDirectory "%APP_DIR%"
nssm set %SERVICE_NAME% AppEnvironmentExtra HOST=0.0.0.0
nssm set %SERVICE_NAME% DisplayName "DMXr Server"
nssm set %SERVICE_NAME% Description "DMXr bridge server for SignalRGB DMX control"
nssm set %SERVICE_NAME% Start SERVICE_AUTO_START
nssm set %SERVICE_NAME% AppRestartDelay 5000
nssm set %SERVICE_NAME% AppStopMethodSkip 6
nssm set %SERVICE_NAME% AppStopMethodConsole 10000

:: Log configuration
if not exist "logs" mkdir logs
nssm set %SERVICE_NAME% AppStdout "%APP_DIR%logs\dmxr-stdout.log"
nssm set %SERVICE_NAME% AppStderr "%APP_DIR%logs\dmxr-stderr.log"
nssm set %SERVICE_NAME% AppStdoutCreationDisposition 4
nssm set %SERVICE_NAME% AppStderrCreationDisposition 4
nssm set %SERVICE_NAME% AppRotateFiles 1
nssm set %SERVICE_NAME% AppRotateBytes 10485760

echo.
echo  Starting DMXr service...
nssm start %SERVICE_NAME%

echo.
echo  DMXr service installed and started.
echo  Web Manager: http://localhost:8080
echo.
pause
