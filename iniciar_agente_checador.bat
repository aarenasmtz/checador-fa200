@echo off
title Agente Tiempo Real FA200 - Checador Hualong
chcp 65001 > nul
echo =========================================================================
echo   Iniciando Agente en Tiempo Real para Checador Biometrico FA200
echo =========================================================================
cd /d "%~dp0"
python scripts\agent_fa200_realtime.py
pause
