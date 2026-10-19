@echo off
title Hualong - Control de Asistencia FA200
chcp 65001 > nul
cd /d "%~dp0"

echo =============================================================================
echo   Iniciando Plataforma de Control de Asistencia (Grupo Comercial Hualong)
echo =============================================================================
echo.

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python no se encuentra instalado en este equipo.
    pause
    exit /b 1
)

python start.py
pause
