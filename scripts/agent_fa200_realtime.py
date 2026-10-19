#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
AGENTE RESIDENTE EN TIEMPO REAL PARA CHECADOR FA200
=============================================================================
Este servicio se ejecuta en la red local (laptop o PC de sucursal) y:
1. Mantiene enlace continuo con el reloj FA200 (IP 192.168.100.21).
2. Detecta checadas nuevas en tiempo real (cada 3 segundos).
3. Transmite inmediatamente cada marcaje a la nube (api-checador.wpcbajio.com).
4. Cuenta con reconexión automática si el reloj o la red se desconectan.
5. Garantiza cero duplicados mediante la idempotencia SHA-256 del servidor.
=============================================================================
"""

import os
import sys
import time
import json
import ssl
import urllib.request
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

root_dir = Path(__file__).resolve().parent.parent
env_path = root_dir / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)

HOST = os.getenv("FA200_HOST", "192.168.100.21")
PORT = int(os.getenv("FA200_PORT", "4370"))
COMM_KEY = int(os.getenv("FA200_COMM_KEY", "0"))
CLOUD_API_URL = os.getenv("CLOUD_API_URL", "https://api-checador.wpcbajio.com")
DEVICE_CODE = os.getenv("DEVICE_CODE", "FA200-CENTRO-01")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL_SECONDS", "3"))

from zk import ZK

def send_to_cloud(user_id, timestamp, method="FACE"):
    ctx = ssl.create_default_context()
    endpoint = f"{CLOUD_API_URL}/api/devices/simulator/events"
    timestamp_str = timestamp.strftime("%Y-%m-%dT%H:%M:%S")

    payload = {
        "deviceCode": DEVICE_CODE,
        "employeeCode": str(user_id),
        "timestamp": timestamp_str,
        "method": method,
        "eventType": "Auto"
    }

    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AttendanceRealtimeAgent/1.0"
    }

    req = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )

    try:
        res = urllib.request.urlopen(req, context=ctx, timeout=10)
        res_data = json.loads(res.read().decode("utf-8"))
        is_dup = res_data.get("isDuplicate", False)
        event_hash = res_data.get("eventHash", "")
        status = "Duplicado ignorado" if is_dup else "Registrado en nube OK"
        print(f"[{datetime.now().strftime('%H:%M:%S')}] 📡 Checada enviada -> Usuario: {user_id} @ {timestamp_str} [{status}] Hash: {event_hash[:16]}...")
        return True
    except Exception as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Error al transmitir a la nube: {e}")
        return False

def run_agent():
    print("=" * 70)
    print("  🟢 AGENTE DE CAPTURA EN TIEMPO REAL - RELOJ FA200")
    print("=" * 70)
    print(f"  • Reloj local:     {HOST}:{PORT}")
    print(f"  • API en la nube:  {CLOUD_API_URL}")
    print(f"  • Intervalo sondeo: Cada {POLL_INTERVAL} segundos")
    print("  • Presiona Ctrl + C para detener el agente.")
    print("=" * 70 + "\n")

    processed_punches = set()

    while True:
        zk = ZK(HOST, port=PORT, timeout=5, password=COMM_KEY, force_udp=False)
        conn = None
        try:
            conn = zk.connect()
            attendances = conn.get_attendance()

            # En el primer ciclo, registrar las checadas existentes para no reenviar histórico
            if not processed_punches:
                for att in attendances:
                    key = (str(att.user_id), att.timestamp.strftime("%Y-%m-%d %H:%M:%S"))
                    processed_punches.add(key)
                print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ Conectado. Monitoreando checadas en tiempo real ({len(processed_punches)} registros base)...")

            # Detectar checadas nuevas
            for att in attendances:
                key = (str(att.user_id), att.timestamp.strftime("%Y-%m-%d %H:%M:%S"))
                if key not in processed_punches:
                    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 🔔 ¡NUEVA CHECADA DETECTADA EN EL RELOJ!")
                    method = "FACE" if att.status in (15, 16) else "FINGERPRINT"
                    success = send_to_cloud(att.user_id, att.timestamp, method)
                    if success:
                        processed_punches.add(key)

        except Exception as e:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] ⚠️ Reloj no disponible o reconectando: {e}")
        finally:
            if conn:
                try:
                    conn.disconnect()
                except Exception:
                    pass

        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    try:
        run_agent()
    except KeyboardInterrupt:
        print("\n[*] Agente detenido limpiamente.")
