@echo off
title Instalar Agente FA200 como Servicio en Segundo Plano
chcp 65001 > nul
echo =========================================================================
echo   Instalando Agente FA200 como Tarea Residente en Windows
echo =========================================================================
echo.

set "SCRIPT_PATH=%~dp0scripts\agent_fa200_realtime.py"
set "PYTHON_EXE=pythonw.exe"

where %PYTHON_EXE% >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] No se encontró pythonw.exe en el PATH del sistema.
    echo Asegúrese de que Python esté instalado y en la variable PATH.
    pause
    exit /b 1
)

echo Creando tarea programada 'FA200SyncAgent' para inicio automatico con Windows...
schtasks /create /tn "FA200SyncAgent" /tr "\"%PYTHON_EXE%\" \"%SCRIPT_PATH%\"" /sc onlogon /rl highest /f

if %errorlevel% equ 0 (
    echo.
    echo [OK] Tarea programada 'FA200SyncAgent' registrada exitosamente.
    echo Se iniciara automaticamente con Windows en segundo plano sin ventana abierta.
    echo.
    echo Iniciando tarea ahora mismo...
    schtasks /run /tn "FA200SyncAgent"
    echo.
    echo Para ver los logs en tiempo real, consulte el archivo: logs\sync_agent.log
) else (
    echo.
    echo [ERROR] No se pudo registrar la tarea programada.
    echo Ejecute este archivo haciendo clic derecho -> 'Ejecutar como administrador'.
)

echo.
pause
