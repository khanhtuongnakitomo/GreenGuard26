@echo off
setlocal
cd /d "%~dp0pc-demo"
set "PYTHON=..\training\model1\.venv\Scripts\python.exe"
if not exist "%PYTHON%" (
  echo Model 1 training environment was not found at %PYTHON%.
  echo Install the documented PC requirements, then retry.
  exit /b 2
)
"%PYTHON%" src\diagnose_m1.py %*
exit /b %ERRORLEVEL%
