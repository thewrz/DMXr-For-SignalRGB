@echo off
title DMXr Service Uninstaller
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

set SERVICE_NAME=DMXr

echo.
echo  Stopping DMXr service...
nssm stop %SERVICE_NAME% >nul 2>&1

echo  Removing DMXr service...
nssm remove %SERVICE_NAME% confirm

echo.
echo  DMXr service removed.
echo.
pause
