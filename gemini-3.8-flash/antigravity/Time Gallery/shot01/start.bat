@echo off
title 时光画廊 (Time Gallery)
cd /d "%~dp0"
echo ========================================================
echo        时光画廊 (Time Gallery) 本地离线启动器
echo ========================================================
echo.
echo 正在启动本地零依赖 HTTP 服务器并打开浏览器...
start "" "http://localhost:8080"
node scripts/server.js
pause
