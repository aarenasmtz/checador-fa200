@echo off
title Instalar Agente FA200 para Inicio Automatico
chcp 65001 > nul
echo =========================================================================
echo   Instalando Agente FA200 para Inicio Automatico con Windows
echo =========================================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "VBS_SRC=%SCRIPT_DIR%scripts\run_agent_silent.vbs"
set "VBS_DST=%STARTUP_FOLDER%\FA200SyncAgent.vbs"

echo [1/3] Registrando en la carpeta de Inicio de Windows...
copy /y "%VBS_SRC%" "%VBS_DST%" >nul

if exist "%VBS_DST%" (
    echo [OK] Agente configurado en la carpeta de Inicio:
    echo      %VBS_DST%
    echo      (Se iniciara automaticamente cada vez que encienda su laptop/PC)
) else (
    echo [!] No se pudo copiar a la carpeta de Inicio.
)

echo.
echo [2/3] Intentando registrar como Tarea Programada de Windows...
schtasks /create /tn "FA200SyncAgent" /tr "wscript.exe \"%VBS_DST%\"" /sc onlogon /f >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Tarea programada 'FA200SyncAgent' registrada exitosamente.
) else (
    echo [INFO] Registrado mediante Inicio de Usuario (no requirio permisos de Administrador).
)

echo.
echo [3/3] Iniciando agente en segundo plano ahora mismo...
wscript.exe "%VBS_DST%"
echo [OK] Agente iniciado en segundo plano.
echo.
echo =========================================================================
echo   INSTALACION COMPLETADA
echo =========================================================================
echo - El reloj FA200 se sincronizara automaticamente cada 5 segundos.
echo - Para ver los registros de conexion en vivo: logs\sync_agent.log
echo - Para detenerlo o desinstalarlo: ejecute desinstalar_servicio_windows.bat
echo =========================================================================
echo.
pause
