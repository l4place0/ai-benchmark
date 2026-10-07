@echo off
cd /d "%~dp0"
set "TEMP=%~dp0temp"
set "TMP=%~dp0temp"
"%~dp0tools\node.exe" "%~dp0tools\render.cjs"
if errorlevel 1 goto done
"%~dp0tools\node.exe" "%~dp0tools\chapters.cjs"
if errorlevel 1 goto done
"%~dp0tools\node.exe" "%~dp0tools\verify.cjs"
:done
pause
