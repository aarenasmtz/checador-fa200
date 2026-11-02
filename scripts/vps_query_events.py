import sqlite3
import json
import urllib.request

print("--- COLA SQLITE LOCAL DEL SERVICIO DE SINCRONIZACION ---")
conn = sqlite3.connect("/var/www/data/vpn_sync_queue.db")
c = conn.cursor()
c.execute("SELECT user_clock_id, punch_time, method, status, synced_at FROM vpn_punches ORDER BY id DESC LIMIT 5")
for r in c.fetchall():
    print(f"Reloj User: {r[0]} | Fecha/Hora: {r[1]} | Método: {r[2]} | Estado: {r[3]} | Sincronizado: {r[4]}")
conn.close()

print("\n--- ESTADO REPORTADO POR LA API EN TIEMPO REAL ---")
req = urllib.request.Request("http://127.0.0.1:5081/api/v1/devices", headers={"X-Agent-Key": "fa200-sync-agent-secret-key-2026"})
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read())

for dev in data:
    if dev.get("code") == "FA200-CASA-01":
        print(f"Dispositivo:       {dev.get('name')} ({dev.get('code')})")
        print(f"Sucursal:          {dev.get('branchName')}")
        print(f"Estado VPN:        {dev.get('status')}")
        print(f"IP en túnel:       {dev.get('ipAddress')}:{dev.get('port')}")
        print(f"Última conexión:   {dev.get('lastConnectionAt')}")
        print(f"Última sync exitosa: {dev.get('lastSuccessfulSyncAt')}")
        print(f"Error actual:      {dev.get('lastErrorMessage')}")
