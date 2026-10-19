#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
华龙商业集团 (Grupo Comercial Hualong)
Sistema Profesional de Control de Asistencia y Checador Biométrico FA200
Script de Inicialización Local para Demostración y Producción
=============================================================================
"""

import os
import sys
import time
import socket
import signal
import shutil
import urllib.request
import urllib.error
import subprocess
import webbrowser
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT_DIR / "frontend"
API_PROJECT = ROOT_DIR / "src" / "Attendance.Api" / "Attendance.Api.csproj"

API_PORT = 5081
FRONTEND_PORT = 5173

API_URL = f"http://localhost:{API_PORT}"
HEALTH_URL = f"http://localhost:{API_PORT}/health"
FRONTEND_URL = f"http://localhost:{FRONTEND_PORT}"
SWAGGER_URL = f"http://localhost:{API_PORT}/swagger"

processes = []

def print_banner():
    banner = f"""
=============================================================================
  华龙商业集团 · GRUPO COMERCIAL HUALONG
  SISTEMA DE ASISTENCIA Y CONTROL BIOMÉTRICO (FA200)
=============================================================================
  [+] Modo: Demostración Local / Sandbox
  [+] Idiomas: 简体中文 (Predeterminado) & Español (es-MX)
  [+] Credenciales: admin / Admin123!
=============================================================================
"""
    print(banner)

def check_command(cmd, name):
    if not shutil.which(cmd):
        print(f"[!] ERROR: {name} ('{cmd}') no está instalado o no se encuentra en el PATH del sistema.")
        return False
    return True

def kill_process_on_port(port):
    """Libera el puerto si ya había un proceso colgado previo."""
    if os.name == 'nt':
        try:
            cmd = f'netstat -ano | findstr :{port}'
            output = subprocess.check_output(cmd, shell=True, text=True, stderr=subprocess.DEVNULL)
            for line in output.strip().split('\n'):
                parts = line.strip().split()
                if len(parts) >= 5 and "LISTENING" in line:
                    pid = parts[-1]
                    if pid != "0":
                        subprocess.run(f'taskkill /F /PID {pid}', shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                        print(f"[*] Puerto {port} liberado (proceso previo {pid} finalizado).")
        except Exception:
            pass

def wait_for_service(url, timeout=35, service_name="Servicio"):
    print(f"[*] Esperando inicialización de {service_name}...", end="", flush=True)
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if response.status in (200, 301, 302):
                    print(" [LISTO ✓]")
                    return True
        except Exception:
            pass
        print(".", end="", flush=True)
        time.sleep(1)
    print(" [TIEMPO AGOTADO ✕]")
    return False

def cleanup(sig=None, frame=None):
    print("\n\n[*] Deteniendo servicios y liberando puertos...")
    for p in processes:
        try:
            if os.name == 'nt':
                subprocess.run(f'taskkill /F /T /PID {p.pid}', shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                p.terminate()
        except Exception:
            pass
    kill_process_on_port(API_PORT)
    kill_process_on_port(FRONTEND_PORT)
    print("[*] Todos los servicios han sido cerrados limpiamente. ¡Hasta luego!\n")
    sys.exit(0)

def main():
    print_banner()

    # 1. Validar requisitos de sistema
    if not check_command("dotnet", ".NET SDK"):
        sys.exit(1)
    if not check_command("node", "Node.js"):
        sys.exit(1)
    if not check_command("npm", "NPM"):
        sys.exit(1)

    # 2. Limpiar puertos ocupados previamente
    print("[*] Verificando puertos disponibles...")
    kill_process_on_port(API_PORT)
    kill_process_on_port(FRONTEND_PORT)

    # Registrar manejador de Ctrl+C
    signal.signal(signal.SIGINT, cleanup)
    if hasattr(signal, 'SIGTERM'):
        signal.signal(signal.SIGTERM, cleanup)

    # 3. Iniciar Backend .NET 9 API
    print(f"[*] Arrancando Backend API .NET 9 ({API_PROJECT.name})...")
    api_cmd = ["dotnet", "run", "--project", str(API_PROJECT)]
    api_proc = subprocess.Popen(
        api_cmd,
        cwd=str(ROOT_DIR),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    processes.append(api_proc)

    # Esperar a que la API responda en /health
    if not wait_for_service(HEALTH_URL, timeout=40, service_name="Backend API (.NET 9)"):
        print("[!] No se pudo conectar con el Backend API. Verifique su base de datos SQL Server.")
        cleanup()

    # 4. Iniciar Frontend Vite + React 19
    print(f"[*] Arrancando Frontend Web (React 19 + TypeScript + Vite)...")
    npm_cmd = "npm.cmd" if os.name == 'nt' else "npm"
    frontend_cmd = [npm_cmd, "run", "dev"]
    frontend_proc = subprocess.Popen(
        frontend_cmd,
        cwd=str(FRONTEND_DIR),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    processes.append(frontend_proc)

    # Esperar a que el frontend responda
    if not wait_for_service(FRONTEND_URL, timeout=25, service_name="Frontend Web"):
        print("[!] No se pudo conectar con el Frontend Web.")
        cleanup()

    # 5. Todo listo: Mostrar resumen en consola
    print("\n" + "=" * 77)
    print("  🚀 PLATAFORMA EN EJECUCIÓN EXITOSA (SISTEMA LISTO PARA CLIENTE)")
    print("=" * 77)
    print(f"  🌐 Aplicación Web:       {FRONTEND_URL}")
    print(f"  📚 Documentación API:   {SWAGGER_URL}")
    print(f"  💓 Estado del Sistema:   {HEALTH_URL}")
    print("-" * 77)
    print("  🔑 CREDENCIALES DE ACCESO:")
    print("     Usuario:    admin")
    print("     Contraseña: Admin123!")
    print("     Rol:        SUPERADMIN (华龙商业集团)")
    print("=" * 77)
    print("  [*] Presione Ctrl + C en cualquier momento para detener los servicios.")
    print("=" * 77 + "\n")

    # 6. Abrir automáticamente en el navegador web predeterminado
    try:
        time.sleep(1)
        webbrowser.open(FRONTEND_URL)
    except Exception:
        pass

    # Mantener el proceso vivo escuchando señales
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        cleanup()

if __name__ == "__main__":
    main()
