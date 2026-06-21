@echo off
cd /d "%~dp0.."
echo === Mithron Load Test (10 min) ===
set LOAD_TEST_ALLOW_DEGRADED=1
node tools\run-load-test.mjs
if errorlevel 1 exit /b 1
node tools\generate-load-test-report.mjs
if errorlevel 1 exit /b 1
echo.
echo Report saved to docs\load-stress-test-report.md
type docs\load-stress-test-report.md
