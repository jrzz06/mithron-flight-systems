@echo off
cd /d "%~dp0"
echo Installing Global Products catalog banner...
node tools/install-catalog-showcase-images.mjs
if errorlevel 1 exit /b 1
echo Optimizing catalog showcase variants...
node tools/optimize-catalog-showcases.mjs
echo Done. Refresh /category/global-products in your browser.
pause
