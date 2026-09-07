@echo off
setlocal
cd /d "%~dp0"
set "PYTHONDONTWRITEBYTECODE=1"
if exist "runtime\python\python.exe" (
  set "PYTHON=runtime\python\python.exe"
) else if exist "..\pc-demo\.venv\Scripts\python.exe" (
  set "PYTHON=..\pc-demo\.venv\Scripts\python.exe"
) else (
  set "PYTHON=py -3.11"
)
%PYTHON% src\app.py %*
