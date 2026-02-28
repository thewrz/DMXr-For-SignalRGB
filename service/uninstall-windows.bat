@echo off
REM DMXr Windows Service Uninstaller
REM Run as Administrator

setlocal

set SERVICE_NAME=DMXr
set NSSM=nssm.exe

where %NSSM% >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: nssm.exe not found in PATH.
    exit /b 1
)

echo Stopping %SERVICE_NAME% service...
%NSSM% stop %SERVICE_NAME% 2>nul

echo Removing %SERVICE_NAME% service...
%NSSM% remove %SERVICE_NAME% confirm

echo.
echo Service "%SERVICE_NAME%" removed.

endlocal
