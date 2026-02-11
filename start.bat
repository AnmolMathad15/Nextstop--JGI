@echo off
title Nextstop JGI - Local Server

echo ===============================
echo   Starting NEXTSTOP-JGI locally
echo ===============================
echo.

cd /d "%~dp0"

echo Running server...
echo.

npm run dev

pause
