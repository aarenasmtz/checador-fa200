#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
SERVICIO CENTRALIZADO DE SINCRONIZACIÓN FA200 MULTI-SUCURSAL VÍA VPN (MANGO)
=============================================================================
Arquitectura:
1. Se ejecuta centralizadamente en el servidor (VPS Hostinger).
2. Consulta de forma independiente cada checador FA200 en su IP privada
   alcanzable por el túnel WireGuard (ej. 10.10.1.10, 10.10.2.10, etc.).
3. Aislamiento por sucursal: una sucursal apagada o sin internet NO bloquea
   ni retrasa la sincronización de las demás sucursales.
4. Prevención de concurrencia: bloqueos por dispositivo para evitar múltiples
   conexiones simultáneas al mismo socket TCP 4370.
5. Operación estrictamente Read-Only sobre el reloj biométrico:
   - NO borra checadas del FA200.
   - NO modifica fecha ni hora del reloj.
   - NO reinicia ni altera la configuración del equipo.
6. Idempotencia y deduplicación con hash SHA-256.
7. Espera progresiva (Exponential Backoff) ante fallos de conexión por sucursal.
8. Envío de latidos (Heartbeat) con métricas reales a la API.
=============================================================================
"""

import os
import sys
import time
import json
import ssl
import sqlite3
import hashlib
import logging
import threading
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from logging.handlers import RotatingFileHandler

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Determinar directorios base
BASE_DIR = Path(__file__).resolve().parent.parent
CONFIG_PATH = BASE_DIR / "sync_agent_config.json"

DEFAULT_CONFIG = {
    "ApiUrl": "http://127.0.0.1:5081",
    "AgentApiKey": "fa200-sync-agent-secret-key-2026",
    "DefaultPollIntervalSeconds": 30,
    "BatchSize": 100,
    "HeartbeatIntervalSeconds": 60,
    "DbPath": "data/vpn_sync_queue.db",
    "LogPath": "logs/server_vpn_sync.log",
    "MaxWorkers": 5
}

CONFIG = DEFAULT_CONFIG
if CONFIG_PATH.exists():
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            CONFIG = {**DEFAULT_CONFIG, **json.load(f)}
    except Exception as e:
        print(f"[!] Error leyendo {CONFIG_PATH}, usando valores por defecto: {e}")

DB_FILE = BASE_DIR / CONFIG["DbPath"]
LOG_FILE = BASE_DIR / CONFIG["LogPath"]

DB_FILE.parent.mkdir(parents=True, exist_ok=True)
LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

# Configurar Logging rotativo
logger = logging.getLogger("FA200VpnSync")
logger.setLevel(logging.INFO)

formatter = logging.Formatter("[%(asctime)s] [%(levelname)s] [%(threadName)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")

console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)

file_handler = RotatingFileHandler(LOG_FILE, maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8")
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

# Cargar pyzk
try:
    from zk import ZK
except ImportError:
    logger.error("No se encontró el paquete 'pyzk'. Instálelo con: pip install pyzk")
    sys.exit(1)


class LocalQueueManager:
    """Gestiona la persistencia local de checadas para garantizar entrega atómica."""
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._local = threading.local()
        self._init_db()

    def get_connection(self):
        if not hasattr(self._local, "conn") or self._local.conn is None:
            self._local.conn = sqlite3.connect(str(self.db_path), timeout=30.0)
            self._local.conn.row_factory = sqlite3.Row
        return self._local.conn

    def _init_db(self):
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vpn_punches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_code TEXT NOT NULL,
                branch_id INTEGER,
                user_clock_id TEXT NOT NULL,
                punch_time TEXT NOT NULL,
                method TEXT NOT NULL,
                punch_type TEXT NOT NULL,
                punch_code INTEGER DEFAULT 255,
                event_hash TEXT UNIQUE NOT NULL,
                status TEXT DEFAULT 'pending',
                error_message TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                synced_at TEXT
            );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_vpn_punches_status ON vpn_punches(status);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_vpn_punches_dev ON vpn_punches(device_code);")
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_vpn_punches_hash ON vpn_punches(event_hash);")
        conn.commit()
        conn.close()

    def save_punches(self, device_code: str, branch_id: int, punches: list) -> int:
        if not punches:
            return 0
        conn = self.get_connection()
        cursor = conn.cursor()
        inserted = 0
        for p in punches:
            try:
                cursor.execute("""
                    INSERT INTO vpn_punches
                    (device_code, branch_id, user_clock_id, punch_time, method, punch_type, punch_code, event_hash, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
                    ON CONFLICT(event_hash) DO NOTHING;
                """, (
                    device_code,
                    branch_id,
                    p["user_id"],
                    p["punch_time"],
                    p["method"],
                    p["punch_type"],
                    p.get("punch_code", 255),
                    p["event_hash"]
                ))
                if cursor.rowcount > 0:
                    inserted += 1
            except Exception as e:
                logger.error(f"Error guardando punch {p.get('event_hash')}: {e}")
        conn.commit()
        return inserted

    def get_pending(self, device_code: str, limit: int = 100) -> list:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, device_code, branch_id, user_clock_id, punch_time, method, punch_type, punch_code, event_hash
            FROM vpn_punches
            WHERE device_code = ? AND status = 'pending'
            ORDER BY punch_time ASC
            LIMIT ?;
        """, (device_code, limit))
        return [dict(row) for row in cursor.fetchall()]

    def mark_synced(self, punch_ids: list):
        if not punch_ids:
            return
        conn = self.get_connection()
        cursor = conn.cursor()
        now_str = datetime.now(timezone.utc).isoformat()
        placeholders = ",".join("?" for _ in punch_ids)
        cursor.execute(f"""
            UPDATE vpn_punches
            SET status = 'synced', synced_at = ?
            WHERE id IN ({placeholders});
        """, [now_str] + punch_ids)
        conn.commit()

    def count_pending(self, device_code: str) -> int:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM vpn_punches WHERE device_code = ? AND status = 'pending';", (device_code,))
        return cursor.fetchone()[0]


class DeviceWorker:
    """Controlador de sincronización autónomo e independiente para un reloj FA200 específico."""
    def __init__(self, device: dict, queue: LocalQueueManager, api_url: str, api_key: str):
        self.device = device
        self.queue = queue
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.lock = threading.Lock()

        self.device_code = device["code"]
        self.branch_id = device["branchId"]
        self.ip_address = device.get("ipAddress")
        self.port = int(device.get("port") or 4370)
        self.sync_interval = int(device.get("syncIntervalSeconds") or 30)

        self.last_sync_time = 0
        self.consecutive_errors = 0
        self.firmware = None
        self.serial_number = None

    def update_config(self, device: dict):
        self.device = device
        self.branch_id = device["branchId"]
        self.ip_address = device.get("ipAddress")
        self.port = int(device.get("port") or 4370)
        self.sync_interval = int(device.get("syncIntervalSeconds") or 30)

    def is_due(self) -> bool:
        now = time.time()
        backoff = min(120, self.sync_interval * (2 ** min(self.consecutive_errors, 3)))
        return (now - self.last_sync_time) >= backoff

    def compute_hash(self, user_id: str, timestamp_str: str, method: str) -> str:
        raw = f"{self.device_code}:{user_id}:{timestamp_str}:{method}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest().lower()

    def sync(self):
        if not self.ip_address:
            logger.warning(f"[{self.device_code}] Omitido: sin dirección IP configurada.")
            return

        if not self.lock.acquire(blocking=False):
            logger.info(f"[{self.device_code}] Sincronización ya en curso para este dispositivo. Omitiendo ciclo.")
            return

        try:
            self._do_sync()
        finally:
            self.lock.release()

    def _do_sync(self):
        self.last_sync_time = time.time()
        logger.info(f"[{self.device_code}] Conectando a FA200 en {self.ip_address}:{self.port} vía VPN...")

        zk = ZK(self.ip_address, port=self.port, timeout=5, force_udp=False, ommit_ping=True)
        conn = None
        new_punches = []

        try:
            conn = zk.connect()

            # Leer metadatos de hardware si están pendientes
            if not self.serial_number:
                try:
                    self.serial_number = conn.get_serialnumber()
                    self.firmware = conn.get_firmware_version()
                except Exception:
                    pass

            # Deshabilitar levemente para captura limpia
            try:
                conn.disable_device()
            except Exception:
                pass

            attendances = conn.get_attendance()

            for att in attendances:
                user_id = str(att.user_id).strip()
                punch_time_str = att.timestamp.strftime("%Y-%m-%dT%H:%M:%S")
                method = "Face" if getattr(att, "status", 0) in (15, 16) else "Fingerprint"
                punch_code = getattr(att, "punch", 255)
                event_hash = self.compute_hash(user_id, punch_time_str, method)

                new_punches.append({
                    "user_id": user_id,
                    "punch_time": punch_time_str,
                    "method": method,
                    "punch_type": "Punch",
                    "punch_code": punch_code,
                    "event_hash": event_hash
                })

            # Guardar en cola SQLite local
            inserted = self.queue.save_punches(self.device_code, self.branch_id, new_punches)
            if inserted > 0:
                logger.info(f"[{self.device_code}] 🔔 {inserted} checadas nuevas capturadas desde el reloj.")

            # Transmitir a la API
            self._transmit_pending_batches(inserted)

            # Notificar heartbeat exitoso
            self.consecutive_errors = 0
            self._send_heartbeat(is_online=True, last_sync_records=inserted)

        except Exception as e:
            self.consecutive_errors += 1
            error_msg = f"No se pudo conectar al reloj {self.ip_address}:{self.port}: {e}"
            logger.warning(f"[{self.device_code}] ⚠️ {error_msg} (Fallo #{self.consecutive_errors})")
            self._send_heartbeat(is_online=False, error_msg=str(e))
        finally:
            if conn:
                try:
                    conn.enable_device()
                except Exception:
                    pass
                try:
                    conn.disconnect()
                except Exception:
                    pass

    def _transmit_pending_batches(self, recent_inserted: int):
        while True:
            pending = self.queue.get_pending(self.device_code, limit=100)
            if not pending:
                break

            endpoint = f"{self.api_url}/api/v1/devices/events/batch"
            events_payload = [
                {
                    "userClockId": p["user_clock_id"],
                    "timestamp": p["punch_time"],
                    "method": p["method"],
                    "eventType": p["punch_type"],
                    "nativePunchCode": p.get("punch_code", 255)
                }
                for p in pending
            ]

            payload = {
                "deviceCode": self.device_code,
                "branchId": self.branch_id,
                "events": events_payload
            }

            headers = {
                "Content-Type": "application/json",
                "X-Agent-Key": self.api_key
            }

            ctx = ssl.create_default_context()
            req = urllib.request.Request(
                endpoint,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST"
            )

            try:
                with urllib.request.urlopen(req, context=ctx, timeout=15) as res:
                    res_data = json.loads(res.read().decode("utf-8"))

                if res_data.get("success"):
                    persisted = res_data.get("persistedCount", 0)
                    duplicate = res_data.get("duplicateCount", 0)
                    ids = [p["id"] for p in pending]
                    self.queue.mark_synced(ids)
                    logger.info(f"[{self.device_code}] ☁️ Batch enviado a la API: {persisted} nuevos, {duplicate} ya registrados.")
                else:
                    logger.error(f"[{self.device_code}] ❌ API rechazó el lote: {res_data.get('message')}")
                    break
            except Exception as e:
                logger.error(f"[{self.device_code}] ❌ Error enviando batch a la API: {e}")
                break

    def _send_heartbeat(self, is_online: bool, last_sync_records: int = 0, error_msg: str = None):
        endpoint = f"{self.api_url}/api/v1/devices/heartbeat"
        pending_count = self.queue.count_pending(self.device_code)

        payload = {
            "deviceCode": self.device_code,
            "isOnline": is_online,
            "firmware": self.firmware or "Ver 6.60",
            "serialNumber": self.serial_number,
            "pendingQueueCount": pending_count,
            "lastSyncAt": datetime.now(timezone.utc).isoformat() if is_online else None,
            "lastSuccessfulSyncAt": datetime.now(timezone.utc).isoformat() if is_online else None,
            "lastSyncRecordsCount": last_sync_records if is_online else None,
            "lastError": error_msg
        }

        headers = {
            "Content-Type": "application/json",
            "X-Agent-Key": self.api_key
        }

        ctx = ssl.create_default_context()
        req = urllib.request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST"
        )

        try:
            with urllib.request.urlopen(req, context=ctx, timeout=10) as res:
                pass
        except Exception as e:
            logger.debug(f"[{self.device_code}] Heartbeat falló: {e}")


class MultiDeviceSyncEngine:
    """Motor orquestador que descubre y sincroniza todos los relojes FA200 en paralelo."""
    def __init__(self, config: dict):
        self.config = config
        self.api_url = config["ApiUrl"].rstrip("/")
        self.api_key = config["AgentApiKey"]
        self.queue = LocalQueueManager(DB_FILE)
        self.workers = {}  # device_code -> DeviceWorker
        self.running = True

    def fetch_devices(self) -> list:
        endpoint = f"{self.api_url}/api/v1/devices"
        headers = {"X-Agent-Key": self.api_key}
        ctx = ssl.create_default_context()
        req = urllib.request.Request(endpoint, headers=headers, method="GET")

        try:
            with urllib.request.urlopen(req, context=ctx, timeout=10) as res:
                data = json.loads(res.read().decode("utf-8"))
                return data if isinstance(data, list) else []
        except Exception as e:
            logger.warning(f"No se pudo consultar el catálogo de dispositivos de la API ({endpoint}): {e}")
            return []

    def refresh_workers(self):
        devices = self.fetch_devices()
        active_codes = set()

        for dev in devices:
            code = dev.get("code")
            is_enabled = dev.get("isEnabled", True)
            ip_addr = dev.get("ipAddress")

            if not code or not is_enabled or not ip_addr:
                continue

            active_codes.add(code)
            if code not in self.workers:
                logger.info(f"Registrando nuevo worker para dispositivo: {code} en {ip_addr}:{dev.get('port', 4370)}")
                self.workers[code] = DeviceWorker(dev, self.queue, self.api_url, self.api_key)
            else:
                self.workers[code].update_config(dev)

        # Remover workers deshabilitados
        for code in list(self.workers.keys()):
            if code not in active_codes:
                logger.info(f"Eliminando worker para dispositivo deshabilitado: {code}")
                del self.workers[code]

    def run(self):
        logger.info("=" * 75)
        logger.info("🚀 INICIANDO MOTOR CENTRALIZADO FA200 VPN MULTI-SUCURSAL (MANGO)")
        logger.info("=" * 75)
        logger.info(f"• API Endpoint: {self.api_url}")
        logger.info(f"• Cola Local:   {DB_FILE}")
        logger.info(f"• Archivo Logs: {LOG_FILE}")
        logger.info("=" * 75)

        last_discovery = 0

        while self.running:
            try:
                now = time.time()
                # Refrescar dispositivos cada 60 segundos
                if (now - last_discovery) >= 60 or not self.workers:
                    self.refresh_workers()
                    last_discovery = now

                # Disparar sincronización para los que estén a tiempo
                threads = []
                for code, worker in list(self.workers.items()):
                    if worker.is_due():
                        t = threading.Thread(target=worker.sync, name=f"Sync-{code}", daemon=True)
                        threads.append(t)
                        t.start()

                # Esperar 2 segundos antes del siguiente ciclo
                time.sleep(2)

            except KeyboardInterrupt:
                logger.info("Interrupción por usuario. Apagando motor limpiamente...")
                self.running = False
            except Exception as e:
                logger.error(f"Error en bucle orquestador: {e}")
                time.sleep(5)


if __name__ == "__main__":
    engine = MultiDeviceSyncEngine(CONFIG)
    engine.run()
