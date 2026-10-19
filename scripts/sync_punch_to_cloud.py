#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sincronizador Puente Local -> Nube para FA200
==============================================
1. Lee las checadas físicas directamente del reloj FA200 por TCP 4370.
2. Identifica al empleado por su User ID (ej. 1 -> Aaron Arenas Martinez / EMP001).
3. Transmite la checada vía HTTPS al sistema desplegado (api-checador.wpcbajio.com).
4. El backend calcula el hash SHA-256 e inserta el evento de asistencia.
"""

import os
import sys
import json
import urllib.request
import ssl
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

print("=" * 65)
print("🚀 SINCRONIZADOR PUENTE FA200 -> SISTEMA EN LA NUBE")
print("=" * 65)
print(f"• Reloj local:     {HOST}:{PORT}")
print(f"• API en la nube:  {CLOUD_API_URL}")
print(f"• Dispositivo ID:  {DEVICE_CODE}")
print("-" * 65)

from zk import ZK

def sync_punches():
    zk = ZK(HOST, port=PORT, timeout=5, password=COMM_KEY, force_udp=False)
    conn = None
    try:
        print("[1/3] Conectando con el reloj FA200...")
        conn = zk.connect()
        print("  ✓ Conexión TCP establecida con éxito.")

        print("\n[2/3] Leyendo registros de checadas en memoria...")
        attendances = conn.get_attendance()
        print(f"  ✓ Total de checadas encontradas en el reloj: {len(attendances)}")

        if not attendances:
            print("[!] No hay checadas pendientes en el reloj.")
            return

        ctx = ssl.create_default_context()
        endpoint = f"{CLOUD_API_URL}/api/devices/events"

        print(f"\n[3/3] Transmitiendo checadas hacia {CLOUD_API_URL}...")
        for att in attendances:
            # Mapear método de marcaje según status
            method = "FACE" if att.status in (15, 16) else "FINGERPRINT"
            timestamp_str = att.timestamp.strftime("%Y-%m-%dT%H:%M:%S")

            payload = {
                "deviceCode": DEVICE_CODE,
                "employeeCode": str(att.user_id),
                "timestamp": timestamp_str,
                "method": method,
                "eventType": "Auto"
            }

            headers = {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AttendanceBridge/1.0"
            }

            req = urllib.request.Request(
                endpoint,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST"
            )

            try:
                res = urllib.request.urlopen(req, context=ctx, timeout=15)
                res_data = json.loads(res.read().decode("utf-8"))
                is_duplicate = res_data.get("isDuplicate", False)
                event_hash = res_data.get("eventHash", "")
                
                status_icon = "⚠️ (Duplicado ignorado)" if is_duplicate else "✅ (Registrado exitosamente)"
                print(f"  • Usuario {att.user_id} @ {timestamp_str} -> {status_icon}")
                print(f"    Hash SHA-256: {event_hash[:20]}...")
            except urllib.error.HTTPError as e:
                body = e.read().decode('utf-8', errors='ignore')
                print(f"  ❌ Error HTTP {e.code} al enviar usuario {att.user_id}: {body}")
            except Exception as e:
                print(f"  ❌ Error de conexión al enviar usuario {att.user_id}: {e}")

        print("\n" + "=" * 65)
        print("🎉 ¡Sincronización finalizada!")
        print("   Entra a https://checador.wpcbajio.com para ver tu checada")
        print("   en el Dashboard y en la matriz de Asistencias.")
        print("=" * 65)

    except Exception as ex:
        print(f"❌ Error al comunicar con el reloj FA200: {ex}")
    finally:
        if conn:
            try:
                conn.disconnect()
            except Exception:
                pass

if __name__ == "__main__":
    sync_punches()
