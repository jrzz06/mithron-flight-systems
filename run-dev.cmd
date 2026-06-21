@echo off
cd /d "%~dp0"
echo Starting Mithron dev server at http://127.0.0.1:3000 ...
call npm run dev
