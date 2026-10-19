@echo off
title Desinstalar Agente FA200
chcp 65001 > nul
echo =========================================================================
echo   Desinstalando Agente Residente FA200
echo =========================================================================
echo.

set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "VBS_DST=%STARTUP_FOLDER%\FA200SyncAgent.vbs"

echo [1/3] Eliminando de la carpeta de Inicio de Windows...
if exist "%VBS_DST%" (
    del /f /q "%VBS_DST%" >nul
    echo [OK] Acceso directo eliminado de Inicio.
) else (
    echo [INFO] No habia acceso en la carpeta de Inicio.
)

echo.
echo [2/3] Eliminando tarea programada 'FA200SyncAgent' (si existe)...
schtasks /end /tn "FA200SyncAgent" >nul 2>&1
schtasks /delete /tn "FA200SyncAgent" /f >nul 2>&1
echo [OK] Tarea programada removida.

echo.
echo [3/3] Deteniendo procesos en segundo plano...
taskkill /f /im pythonw.exe >nul 2>&1
echo [OK] Procesos detenidos.

echo.
echo =========================================================================
echo   DESINSTALACION COMPLETADA
echo =========================================================================
echo.
pause
