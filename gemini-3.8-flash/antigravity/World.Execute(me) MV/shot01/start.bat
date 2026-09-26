@echo off
chcp 65001 >nul
title Mili - world.execute(me); Interactive Player
echo Starting local web server...
start "" "http://localhost:8080/"
node scripts/server.mjs
pause
