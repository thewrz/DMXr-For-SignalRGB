@echo off
REM DMXr Windows Service Installer (requires NSSM — https://nssm.cc)
REM Run as Administrator

setlocal

set SERVICE_NAME=DMXr
set NSSM=nssm.exe
set APP_DIR=%~dp0..\server
set NODE_EXE=node.exe
set APP_SCRIPT=%APP_DIR%\dist\index.js

REM Check for NSSM
where %NSSM% >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: nssm.exe not found in PATH.
    echo Download from https://nssm.cc and add to PATH.
    exit /b 1
)

REM Check for compiled output
if not exist "%APP_SCRIPT%" (
    echo ERROR: %APP_SCRIPT% not found.
    echo Run "npm run build" in the server directory first.
    exit /b 1
)

echo Installing %SERVICE_NAME% service...

%NSSM% install %SERVICE_NAME% %NODE_EXE% "%APP_SCRIPT%"
%NSSM% set %SERVICE_NAME% AppDirectory "%APP_DIR%"
%NSSM% set %SERVICE_NAME% Description "DMXr — SignalRGB to DMX bridge server"

REM Environment variables (edit these for your setup)
%NSSM% set %SERVICE_NAME% AppEnvironmentExtra ^
    PORT=8080 ^
    HOST=0.0.0.0 ^
    DMX_DRIVER=enttec-usb-dmx-pro ^
    DMX_DEVICE_PATH=COM3

REM Restart on failure with 5s delay
%NSSM% set %SERVICE_NAME% AppRestartDelay 5000

REM Graceful shutdown: send Ctrl+C and wait 10s for blackout + serial drain
%NSSM% set %SERVICE_NAME% AppStopMethodSkip 6
%NSSM% set %SERVICE_NAME% AppStopMethodConsole 10000

REM Logging
if not exist "%APP_DIR%\logs" mkdir "%APP_DIR%\logs"
%NSSM% set %SERVICE_NAME% AppStdout "%APP_DIR%\logs\dmxr-stdout.log"
%NSSM% set %SERVICE_NAME% AppStderr "%APP_DIR%\logs\dmxr-stderr.log"
%NSSM% set %SERVICE_NAME% AppStdoutCreationDisposition 4
%NSSM% set %SERVICE_NAME% AppStderrCreationDisposition 4
%NSSM% set %SERVICE_NAME% AppRotateFiles 1
%NSSM% set %SERVICE_NAME% AppRotateBytes 1048576

echo.
echo Service "%SERVICE_NAME%" installed successfully.
echo.
echo To start:  nssm start %SERVICE_NAME%
echo To stop:   nssm stop %SERVICE_NAME%
echo To status: nssm status %SERVICE_NAME%
echo To remove: nssm remove %SERVICE_NAME% confirm
echo.
echo Edit environment variables with: nssm edit %SERVICE_NAME%

endlocal
