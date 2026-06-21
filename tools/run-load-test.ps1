# Mithron 10-minute load & stress test runner
# Usage: powershell -ExecutionPolicy Bypass -File tools/run-load-test.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
Set-Location ..

Write-Host "=== Mithron Load & Stress Test ===" -ForegroundColor Cyan
Write-Host "Duration: ~10 minutes (3 x 200s scenarios)" -ForegroundColor Gray
Write-Host ""

# Health check
try {
    $health = Invoke-WebRequest -Uri "http://127.0.0.1:3000/api/health" -UseBasicParsing -TimeoutSec 10
    Write-Host "Health endpoint: $($health.StatusCode) $($health.Content)" -ForegroundColor $(if ($health.StatusCode -eq 200) { "Green" } else { "Yellow" })
} catch {
    Write-Host "Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

try {
    $home = Invoke-WebRequest -Uri "http://127.0.0.1:3000/" -UseBasicParsing -TimeoutSec 15
    if (-not $home.StatusCode -eq 200) { throw "Homepage returned $($home.StatusCode)" }
    Write-Host "Storefront reachable: OK" -ForegroundColor Green
} catch {
    Write-Host "Storefront not reachable. Starting server..." -ForegroundColor Yellow
    if (-not (Test-Path ".next")) {
        Write-Host "Building production bundle..." -ForegroundColor Yellow
        npm run build
    }
    Start-Process npm -ArgumentList "run","start" -WorkingDirectory (Get-Location) -WindowStyle Hidden
    Start-Sleep -Seconds 20
}

$env:LOAD_TEST_ALLOW_DEGRADED = "1"
Write-Host ""
Write-Host "Starting load test (this will take ~10 minutes)..." -ForegroundColor Cyan
node tools/run-load-test.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Generating report..." -ForegroundColor Cyan
node tools/generate-load-test-report.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "=== Complete ===" -ForegroundColor Green
Write-Host "Results: tools/load-test-results.json"
Write-Host "Report:  docs/load-stress-test-report.md"
Write-Host ""
Get-Content docs/load-stress-test-report.md
