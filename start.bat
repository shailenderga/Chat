@echo off
title Wavy Full Stack Launcher
echo ====================================================
echo             Wavy - Modern Private Chat
echo ====================================================

:: Free lingering ports 5000 and 3000 if already occupied
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r ":5000.*LISTENING"') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r ":3000.*LISTENING"') do taskkill /f /pid %%a >nul 2>&1

echo Starting Backend Server on http://localhost:5000 ...
start "Wavy Backend Server" cmd /k "cd /d %~dp0server && node server.js"

timeout /t 3 /nobreak >nul

echo Starting Frontend Vite Client on http://localhost:3000 ...
start "Wavy Frontend Client" cmd /k "cd /d %~dp0client && npm run dev"

echo.
echo ====================================================
echo Both Servers are launching!
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:5000
echo Super Admin: shailenderga@gmail.com / 84249691@Sg
echo ====================================================
timeout /t 4 >nul
start http://localhost:3000
