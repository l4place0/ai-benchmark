@echo off
chcp 65001 >nul
echo ============================================================
echo   大型客家土楼村落 3D 体素景观 - 本地交互检视器
echo   Hakka Tulou Village Diorama WebGL Viewer
echo ============================================================
echo.
echo 正在启动本地 Web 服务并打开浏览器...
start "" "http://localhost:8080/index.html"
python -m http.server 8080
if %errorlevel% neq 0 (
    echo Python 未直接加入 PATH，正在尝试使用系统默认浏览器直接打开 index.html...
    start "" "index.html"
)
pause
