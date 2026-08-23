@echo off
rem Model 2 ONLY demo (cap / label / ring) - CPU only
setlocal
cd /d "%~dp0"
if exist "..\model1-rebuild\.venv\Scripts\python.exe" (
    set "PY=..\model1-rebuild\.venv\Scripts\python.exe"
) else (
    set "PY=python"
)
"%PY%" scripts\demo_live.py %*
echo.
pause >nul
