@echo off
cd /d "%~dp0"
set "TEMP=%~dp0temp"
set "TMP=%~dp0temp"
"%~dp0tools\node.exe" "%~dp0tools\render-v2.cjs" --preview
pause
