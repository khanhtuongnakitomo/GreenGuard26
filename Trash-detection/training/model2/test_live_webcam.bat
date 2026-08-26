@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo   Running Live Webcam Demo for Model 2 (Cap / Label / Ring)
echo   Controls: Press 'Q' to quit, 'S' to save snapshot
echo ========================================================

..\model1\.venv\Scripts\python.exe scripts\demo_live.py --conf 0.35

pause
