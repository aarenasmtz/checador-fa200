#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Diagnóstico y Prueba de Lectura de Hardware FA200
============================================================
Lee la configuración desde variables de entorno (.env)
Ejecuta exclusivamente operaciones de LECTURA (Read-Only):
- NO enrola usuarios
- NO borra checadas
- NO modifica fecha ni hora
- NO reinicia ni altera el dispositivo
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Cargar configuración externa desde .env
root_dir = Path(__file__).resolve().parent.parent
env_path = root_dir / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

HOST = os.getenv("FA200_HOST", "192.168.100.21")
PORT = int(os.getenv("FA200_PORT", "4370"))
TIMEOUT = int(os.getenv("FA200_TIMEOUT", "5"))
COMM_KEY = int(os.getenv("FA200_COMM_KEY", "0"))

print("=" * 65)
print("[*] INICIANDO PRUEBA DE COMUNICACION READ-ONLY CON FA200")
print("=" * 65)
print(f"• Destino: {HOST}:{PORT}")
print(f"• Timeout: {TIMEOUT}s")
print(f"• CommKey: {'Configurada (no cero)' if COMM_KEY != 0 else '0 (Predeterminada)'}")
print("-" * 65)

from zk import ZK, const

def try_zk_connection(force_udp=False):
    protocol_name = "UDP" if force_udp else "TCP"
    print(f"\n[+] Probando protocolo ZK sobre {protocol_name}...")
    zk = ZK(
        HOST,
        port=PORT,
        timeout=TIMEOUT,
        password=COMM_KEY,
        force_udp=force_udp,
        verbose=False
    )
    conn = None
    try:
        conn = zk.connect()
        print(f"✅ ¡Conexión establecida con éxito mediante {protocol_name}!")
        
        # Deshabilitar dispositivo temporalmente solo durante la lectura para evitar colisiones
        conn.disable_device()
        
        print("\n--- INFORMACIÓN DE IDENTIFICACIÓN DEL EQUIPO ---")
        try:
            device_name = conn.get_device_name()
            print(f"• Nombre/Modelo reportado: {device_name}")
        except Exception as e:
            print(f"• Nombre/Modelo: No disponible ({e})")
            
        try:
            sn = conn.get_serialnumber()
            print(f"• Número de Serie (SN):   {sn}")
        except Exception as e:
            print(f"• Número de Serie (SN):   No disponible ({e})")
            
        try:
            fw = conn.get_firmware_version()
            print(f"• Versión de Firmware:    {fw}")
        except Exception as e:
            print(f"• Versión de Firmware:    No disponible ({e})")
            
        try:
            platform = conn.get_platform()
            print(f"• Plataforma de Hardware: {platform}")
        except Exception as e:
            print(f"• Plataforma:             No disponible ({e})")

        try:
            mac = conn.get_mac()
            print(f"• Dirección MAC:          {mac}")
        except Exception as e:
            print(f"• Dirección MAC:          No disponible ({e})")

        print("\n--- FECHA Y HORA DEL RELOJ ---")
        try:
            dev_time = conn.get_time()
            print(f"• Fecha y Hora del reloj: {dev_time}")
        except Exception as e:
            print(f"• Fecha y Hora:           No disponible ({e})")

        print("\n--- CAPACIDAD Y ESTADÍSTICAS (READ-ONLY) ---")
        try:
            users = conn.get_users()
            print(f"• Usuarios registrados:   {len(users)}")
            if len(users) > 0:
                print("  Lista de usuarios en memoria (primeros 5):")
                for u in users[:5]:
                    print(f"    - ID: {u.user_id}, Nombre: {u.name}, Privilegio: {u.privilege}, Card: {u.card}")
        except Exception as e:
            print(f"• Consulta de usuarios:   Error ({e})")

        try:
            attendances = conn.get_attendance()
            print(f"• Checadas en memoria:    {len(attendances)}")
            if len(attendances) > 0:
                print("  Últimas checadas registradas (hasta 3):")
                for att in attendances[-3:]:
                    print(f"    - Usuario: {att.user_id}, Timestamp: {att.timestamp}, Punch: {att.punch}, Status: {att.status}")
        except Exception as e:
            print(f"• Consulta de checadas:   Error ({e})")

        # Reactivar el dispositivo
        conn.enable_device()
        return True

    except Exception as ex:
        print(f"❌ Falló conexión con {protocol_name}: {ex}")
        return False
    finally:
        if conn:
            try:
                conn.disconnect()
                print(f"[*] Desconectado limpiamente de {protocol_name}.")
            except Exception:
                pass

def main():
    # 1. Intentar TCP primero
    success = try_zk_connection(force_udp=False)
    if not success:
        print("\n[!] TCP falló o fue rechazado por el protocolo. Intentando alternativa UDP...")
        success = try_zk_connection(force_udp=True)

    print("\n" + "=" * 65)
    if success:
        print("🎉 DIAGNÓSTICO EXITOSO: El FA200 ES COMPATIBLE con el protocolo ZK.")
    else:
        print("⚠️ NO SE PUDO ESTABLECER SESIÓN DE PROTOCOLO:")
        print("   Aunque el puerto TCP 4370 responde a nivel socket, el protocolo")
        print("   de aplicación no respondió al handshake ZK estándar.")
        print("   Causas posibles: CommKey distinta de 0, firmware cifrado o protocolo ADMS exclusivo.")
    print("=" * 65)

if __name__ == "__main__":
    main()
