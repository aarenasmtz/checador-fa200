#!/usr/bin/env python3
import sys
from zk import ZK

print("=================================================================")
print("🌐 PROBANDO LECTURA DIRECTA DEL FA200 DESDE EL VPS POR WIREGUARD")
print("=================================================================")
HOST = "10.10.1.10"
PORT = 4370

zk = ZK(HOST, port=PORT, timeout=5, force_udp=False, ommit_ping=True)
conn = None
try:
    conn = zk.connect()
    print("✅ ¡CONEXIÓN ESTABLECIDA CON ÉXITO DESDE EL VPS!")
    print(f"• Número de serie:  {conn.get_serialnumber()}")
    print(f"• Firmware:         {conn.get_firmware_version()}")
    print(f"• Hora del reloj:   {conn.get_time()}")
    
    users = conn.get_users()
    print(f"• Total usuarios:   {len(users)}")
    for u in users:
        print(f"  - Usuario ID: {u.user_id}, Nombre: {u.name}")
        
    attendances = conn.get_attendance()
    print(f"• Total checadas:   {len(attendances)}")
    if attendances:
        print("  - Últimas 3 checadas en memoria:")
        for att in attendances[-3:]:
            print(f"    * ID {att.user_id} - Fecha: {att.timestamp} - Status: {att.status}")
            
    print("=================================================================")
    print("🎉 LECTURA 100% REAL VALIDADA DESDE ALEMANIA/HOSTINGER POR LA VPN")
    print("=================================================================")
except Exception as ex:
    print(f"❌ Error conectando: {ex}")
    sys.exit(1)
finally:
    if conn:
        try:
            conn.disconnect()
        except Exception:
            pass
