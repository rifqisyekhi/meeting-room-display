@echo off
:: Script bat untuk mereset password PostgreSQL user 'postgres' menjadi 'postgres'
:: Meminta hak Administrator secara otomatis
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Meminta izin Administrator...
    powershell -Command "Start-Process '%~f0' -Verb runAs"
    exit /b
)

title Reset Password PostgreSQL
color 0b
echo ========================================================
echo   RESET PASSWORD POSTGRESQL KE: postgres
echo ========================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0src\scripts\reset-postgres-password.ps1"
pause

