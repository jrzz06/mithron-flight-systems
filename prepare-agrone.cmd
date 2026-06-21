@echo off
cd /d "%~dp0"
node tools\install-agrone-source-images.mjs
if errorlevel 1 exit /b 1
node tools\optimize-agrone-mission-images.mjs
if errorlevel 1 exit /b 1
echo AGRONE assets prepared successfully.
