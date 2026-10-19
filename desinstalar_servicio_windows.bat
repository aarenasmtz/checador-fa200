@echo off
title Desinstalar Agente FA200
chcp 65001 > nul
echo =========================================================================
echo   Desinstalando Agente Residente FA200
echo =========================================================================
echo.
echo Deteniendo y eliminando la tarea programada 'FA200SyncAgent'...
schtasks /end /tn "FA200SyncAgent" >nul 2>&1
schtasks /delete /tn "FA200SyncAgent" /f

echo.
echo [OK] Tarea 'FA200SyncAgent' eliminada correctamente.
pause
