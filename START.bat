@echo off
title Paradigia Outreach Studio
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Download it from https://nodejs.org and run this again. & pause & exit /b 1)
start "" http://localhost:5050
node server.js
pause
