@echo off
REM Package Discord Channel Exporter into a .zip for Chrome Web Store or distribution

setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "NAME=discord-channel-exporter"

REM Extract version from manifest.json
for /f "tokens=2 delims=:" %%a in ('findstr /C:"\"version\"" "%SCRIPT_DIR%manifest.json"') do (
    set "RAW=%%a"
)
set "VERSION=%RAW:"=%"
set "VERSION=%VERSION:,=%"
set "VERSION=%VERSION: =%"

set "OUTPUT=%SCRIPT_DIR%%NAME%-v%VERSION%.zip"

REM Remove old build
if exist "%OUTPUT%" del "%OUTPUT%"

REM Create zip using PowerShell (available on Windows 10+)
powershell -NoProfile -Command ^
    "$files = @('manifest.json','background.js','content.js','popup.html','popup.js','icons','LICENSE','README.md'); " ^
    "Compress-Archive -Path ($files | ForEach-Object { Join-Path '%SCRIPT_DIR%' $_ }) -DestinationPath '%OUTPUT%' -Force"

echo.
echo Packaged: %NAME%-v%VERSION%.zip

endlocal
