@echo off
REM Supabase Upload Script for Windows
REM Usage: remove-backgrounds-upload.cmd

setlocal enabledelayedexpansion

echo.
echo ======================================
echo  Supabase Upload Script
echo ======================================
echo.

REM Check for environment variables
if not defined NEXT_PUBLIC_SUPABASE_URL (
    echo ERROR: NEXT_PUBLIC_SUPABASE_URL not set
    echo.
    echo Please add to your .env.local:
    echo   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
    echo.
    pause
    exit /b 1
)

if not defined SUPABASE_SERVICE_ROLE_KEY (
    echo ERROR: SUPABASE_SERVICE_ROLE_KEY not set
    echo.
    echo Please add to your .env.local:
    echo   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
    echo.
    pause
    exit /b 1
)

echo Checking dependencies...
npm list @supabase/supabase-js >nul 2>&1
if errorlevel 1 (
    echo Installing @supabase/supabase-js...
    call npm install @supabase/supabase-js
    
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
)

echo.
echo Starting upload...
echo URL: %NEXT_PUBLIC_SUPABASE_URL%
echo.

call node scripts\upload-to-supabase.mjs

if errorlevel 1 (
    echo.
    echo ERROR: Upload failed. Check the errors above.
    echo.
    echo Common issues:
    echo  1. Check SUPABASE_SERVICE_ROLE_KEY validity
    echo  2. Check if storage bucket exists
    echo  3. Verify network connection
    echo.
    pause
    exit /b 1
)

echo.
echo SUCCESS! Images uploaded to Supabase.
echo.
echo Check upload-summary.json for details.
echo.
pause
exit /b 0

endlocal
