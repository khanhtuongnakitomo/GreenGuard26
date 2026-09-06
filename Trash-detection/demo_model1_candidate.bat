@echo off
setlocal
cd /d "%~dp0pc-demo"
if not exist "..\training\model1\.venv\Scripts\python.exe" (
    echo Run pc-demo\setup.ps1 first
    exit /b 1
)
"..\training\model1\.venv\Scripts\python.exe" src\app.py --config m1_rvm_candidate --mode model1 %*
