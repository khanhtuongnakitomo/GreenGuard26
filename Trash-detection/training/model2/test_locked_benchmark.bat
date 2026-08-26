@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo   Evaluating Model 2 Candidate vs Baseline on Locked Test Set
echo ========================================================

..\model1\.venv\Scripts\python.exe scripts\eval_locked_test.py

echo.
echo Benchmark log saved to logs\m2_locked_comparison.log
pause
