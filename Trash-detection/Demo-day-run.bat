@echo off
setlocal

call "%~dp0demo-day.bat" %*
exit /b %ERRORLEVEL%
