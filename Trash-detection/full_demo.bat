@echo off
setlocal
call "%~dp0windows-demo\run_demo.bat" %*
exit /b %ERRORLEVEL%
