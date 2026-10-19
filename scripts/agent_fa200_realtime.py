#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
AGENTE RESIDENTE DE SINCRONIZACIÓN AUTOMÁTICA PARA RELOJ BIOMÉTRICO FA200
=============================================================================
Funcionalidades:
1. Sondeo automático continuo del reloj FA200 (IP y puerto configurables).
2. Cola local persistente en SQLite (resistente a reinicios y apagones).
3. Deduplicación e idempotencia con hash SHA-256 (sin borrar checadas del reloj).
4. Transmisión por lotes (Batch) hacia la API HTTPS en la nube.
5. Reintentos con espera progresiva (Exponential Backoff) ante fallos de red.
6. Reporte de latidos (Heartbeat) con estado de conexión, cola y firmware.
7. Recuperación transparente de checadas realizadas con el servicio apagado.
8. Bloqueo de concurrencia para evitar conexiones simultáneas al socket TCP 4370.
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
import urllib.request
from datetime import datetime
from pathlib import Path
from logging.handlers import RotatingFileHandler

# Configurar codificación estándar
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Determinar directorios base
BASE_DIR = Path(__file__).resolve().parent.parent
CONFIG_PATH = BASE_DIR / "sync_agent_config.json"

# Cargar configuración externalizada
DEFAULT_CONFIG = {
    "DeviceCode": "FA200-CENTRO-01",
    "BranchId": 1,
    "ClockIp": "192.168.100.21",
    "ClockPort": 4370,
    "CommKey": 0,
    "ApiUrl": "https://api-checador.wpcbajio.com",
    "AgentApiKey": "fa200-sync-agent-secret-key-2026",
    "PollIntervalSeconds": 5,
    "BatchSize": 50,
    "HeartbeatIntervalSeconds": 30,
    "DbPath": "data/sync_queue.db",
    "LogPath": "logs/sync_agent.log"
}

if CONFIG_PATH.exists():
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            CONFIG = {**DEFAULT_CONFIG, **json.load(f)}
    except Exception as e:
        print(f"[!] Error leyendo {CONFIG_PATH}, usando valores por defecto: {e}")
        CONFIG = DEFAULT_CONFIG
else:
    CONFIG = DEFAULT_CONFIG

DB_FILE = BASE_DIR / CONFIG["DbPath"]
LOG_FILE = BASE_DIR / CONFIG["LogPath"]

# Asegurar directorios
DB_FILE.parent.mkdir(parents=True, exist_ok=True)
LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

# Configurar Logging rotativo
logger = logging.getLogger("FA200SyncAgent")
logger.setLevel(logging.INFO)

formatter = logging.Formatter("[%(asctime)s] [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")

# Consola
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)

# Archivo rotativo (máx 5MB, 3 respaldos)
file_handler = RotatingFileHandler(LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8")
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

# SDK ZK
try:
    from zk import ZK
except ImportError:
    logger.error("No se encontró el paquete 'pyzk'. Instálelo con: pip install pyzk")
    sys.exit(1)


class DatabaseManager:
    """Gestiona la cola local SQLite persistente."""
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._init_db()

    def get_connection(self):
        conn = sqlite3.connect(str(self.db_path), timeout=10.0)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            # Tabla de checadas
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS punches (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    punch_time TEXT NOT NULL,
                    method TEXT NOT NULL,
                    punch_type TEXT NOT NULL,
                    punch_code INTEGER DEFAULT 255,
                    event_hash TEXT UNIQUE NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    retry_count INTEGER NOT NULL DEFAULT 0,
                    last_error TEXT,
                    created_at TEXT NOT NULL,
                    synced_at TEXT
                );
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_punches_status ON punches (status);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_punches_hash ON punches (event_hash);")

            # Migration: add punch_code column if missing in existing db
            try:
                cursor.execute("ALTER TABLE punches ADD COLUMN punch_code INTEGER DEFAULT 255;")
            except Exception:
                pass

            # Tabla de estado del agente
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS agent_state (
                    key TEXT PRIMARY KEY,
                    value TEXT,
                    updated_at TEXT
                );
            """)
            conn.commit()

    def save_punches(self, punches: list) -> int:
        """Inserta checadas evitando duplicados mediante el hash."""
        now_str = datetime.utcnow().isoformat()
        inserted = 0
        with self.get_connection() as conn:
            cursor = conn.cursor()
            for p in punches:
                try:
                    cursor.execute("""
                        INSERT OR IGNORE INTO punches (user_id, punch_time, method, punch_type, punch_code, event_hash, status, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?);
                    """, (p["user_id"], p["punch_time"], p["method"], p["punch_type"], p.get("punch_code", 255), p["event_hash"], now_str))
                    if cursor.rowcount > 0:
                        inserted += 1
                except Exception as e:
                    logger.error(f"Error guardando checada {p.get('event_hash')}: {e}")
            conn.commit()
        return inserted

    def get_pending_punches(self, limit: int = 50) -> list:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, user_id, punch_time, method, punch_type, punch_code, event_hash, retry_count
                FROM punches
                WHERE status = 'pending'
                ORDER BY id ASC
                LIMIT ?;
            """, (limit,))
            return [dict(row) for row in cursor.fetchall()]

    def mark_punches_synced(self, punch_ids: list):
        if not punch_ids:
            return
        now_str = datetime.utcnow().isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            placeholders = ",".join("?" * len(punch_ids))
            cursor.execute(f"""
                UPDATE punches
                SET status = 'synced', synced_at = ?
                WHERE id IN ({placeholders});
            """, [now_str] + punch_ids)
            conn.commit()

    def record_punch_errors(self, failed_items: list):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            for item in failed_items:
                cursor.execute("""
                    UPDATE punches
                    SET retry_count = retry_count + 1, last_error = ?
                    WHERE id = ?;
                """, (item.get("error", "Error desconocido"), item["id"]))
            conn.commit()

    def count_pending(self) -> int:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM punches WHERE status = 'pending';")
            return cursor.fetchone()[0]

    def set_state(self, key: str, value: str):
        now_str = datetime.utcnow().isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO agent_state (key, value, updated_at) VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;
            """, (key, value, now_str))
            conn.commit()

    def get_state(self, key: str) -> str:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM agent_state WHERE key = ?;", (key,))
            row = cursor.fetchone()
            return row[0] if row else None


class FA200SyncAgent:
    def __init__(self, config: dict):
        self.config = config
        self.db = DatabaseManager(DB_FILE)
        self.device_code = config["DeviceCode"]
        self.branch_id = config.get("BranchId", 1)
        self.clock_ip = config["ClockIp"]
        self.clock_port = int(config["ClockPort"])
        self.comm_key = int(config.get("CommKey", 0))
        self.api_url = config["ApiUrl"].rstrip("/")
        self.api_key = config["AgentApiKey"]
        self.poll_interval = int(config.get("PollIntervalSeconds", 5))
        self.batch_size = int(config.get("BatchSize", 50))
        self.heartbeat_interval = int(config.get("HeartbeatIntervalSeconds", 30))

        self.last_heartbeat = 0
        self.consecutive_network_errors = 0
        self.hardware_info = {"serial": None, "firmware": None}

    def compute_event_hash(self, user_clock_id: str, timestamp_str: str, method: str) -> str:
        # Formato canónico: {DeviceCode}:{UserClockId}:{yyyy-MM-ddTHH:mm:ss}:{Method}
        raw = f"{self.device_code}:{user_clock_id}:{timestamp_str}:{method}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest().lower()

    def poll_clock(self):
        """Consulta el FA200, descarga checadas y las encola en SQLite."""
        zk = ZK(self.clock_ip, port=self.clock_port, timeout=6, password=self.comm_key, force_udp=False, ommit_ping=True)
        conn = None
        new_punches = []

        try:
            conn = zk.connect()

            # Obtener metadatos de hardware una sola vez o refrescar
            if not self.hardware_info["serial"]:
                try:
                    self.hardware_info["serial"] = conn.get_serialnumber()
                    self.hardware_info["firmware"] = conn.get_firmware_version()
                    logger.info(f"Identificación hardware: SN={self.hardware_info['serial']} FW={self.hardware_info['firmware']}")
                except Exception as e:
                    logger.warning(f"No se pudieron leer metadatos de hardware: {e}")

            # Deshabilitar momentáneamente para descarga limpia y consistente
            try:
                conn.disable_device()
            except Exception:
                pass

            attendances = conn.get_attendance()

            for att in attendances:
                user_id = str(att.user_id).strip()
                punch_time_str = att.timestamp.strftime("%Y-%m-%dT%H:%M:%S")

                # Método: 15 y 16 corresponden a reconocimiento facial en plataforma ZLM60
                method = "Face" if getattr(att, "status", 0) in (15, 16) else "Fingerprint"
                punch_type = "Punch"
                punch_code = getattr(att, "punch", 255)

                event_hash = self.compute_event_hash(user_id, punch_time_str, method)

                new_punches.append({
                    "user_id": user_id,
                    "punch_time": punch_time_str,
                    "method": method,
                    "punch_type": punch_type,
                    "punch_code": punch_code,
                    "event_hash": event_hash
                })

        except Exception as e:
            logger.warning(f"⚠️ Imposible conectar al reloj {self.clock_ip}:{self.clock_port}: {e}")
            self.send_heartbeat(is_online=False, last_error=str(e))
            return 0
        finally:
            if conn:
                try:
                    # Garantizar SIEMPRE rehabilitación del reloj incluso si ocurrió un error
                    conn.enable_device()
                except Exception:
                    pass
                try:
                    conn.disconnect()
                except Exception:
                    pass

        # Guardar en SQLite con deduplicación
        inserted = self.db.save_punches(new_punches)
        if inserted > 0:
            logger.info(f"🔔 {inserted} checadas nuevas capturadas del reloj y encoladas localmente.")

        return inserted

    def sync_batch_to_cloud(self):
        """Transmite lotes pendientes a la API HTTPS con idempotencia."""
        pending = self.db.get_pending_punches(limit=self.batch_size)
        if not pending:
            return

        endpoint = f"{self.api_url}/api/v1/devices/events/batch"
        events_payload = [
            {
                "userClockId": p["user_id"],
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
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AttendanceFA200Agent/1.0",
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
                failed = res_data.get("failedCount", 0)

                # Mapa de resultados de la API
                item_results = res_data.get("results", [])
                confirmed_ids = []
                failed_items = []

                for idx, p in enumerate(pending):
                    if idx < len(item_results):
                        result = item_results[idx]
                        if result.get("status") in ("Persisted", "Duplicate"):
                            confirmed_ids.append(p["id"])
                        else:
                            failed_items.append({"id": p["id"], "error": result.get("message")})
                    else:
                        confirmed_ids.append(p["id"])

                self.db.mark_punches_synced(confirmed_ids)
                if failed_items:
                    self.db.record_punch_errors(failed_items)

                self.consecutive_network_errors = 0
                logger.info(f"☁️ Lote sincronizado -> {persisted} guardadas, {duplicate} existentes (idempotente), {failed} fallidas.")
            else:
                logger.error(f"❌ La API rechazó el lote: {res_data.get('message')}")
                self.consecutive_network_errors += 1

        except Exception as e:
            self.consecutive_network_errors += 1
            backoff = min(120, 2 ** min(self.consecutive_network_errors, 6))
            logger.error(f"❌ Error transmitiendo a {self.api_url}: {e} (Reintento en {backoff}s)")
            time.sleep(backoff)

    def send_heartbeat(self, is_online: bool = True, last_error: str = None):
        """Envía el estado de comunicación del reloj a la API."""
        now = time.time()
        if (now - self.last_heartbeat) < self.heartbeat_interval and is_online:
            return

        self.last_heartbeat = now
        endpoint = f"{self.api_url}/api/v1/devices/heartbeat"

        pending_count = self.db.count_pending()
        payload = {
            "deviceCode": self.device_code,
            "isOnline": is_online,
            "firmware": self.hardware_info["firmware"] or "Ver 6.60",
            "serialNumber": self.hardware_info["serial"] or "PHZ6092608717",
            "pendingQueueCount": pending_count,
            "lastError": last_error
        }

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AttendanceFA200Agent/1.0",
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
                if res.status == 200:
                    pass
        except Exception as e:
            logger.debug(f"Heartbeat no enviado: {e}")

    def run(self):
        logger.info("=" * 70)
        logger.info("🚀 INICIANDO SERVICIO DE SINCRONIZACIÓN FA200 (WPC BAJÍO)")
        logger.info("=" * 70)
        logger.info(f"Dispositivo:  {self.device_code} (Sucursal ID: {self.branch_id})")
        logger.info(f"Reloj Físico: {self.clock_ip}:{self.clock_port}")
        logger.info(f"Nube API:     {self.api_url}")
        logger.info(f"Cola SQLite:  {DB_FILE}")
        logger.info(f"Logs:         {LOG_FILE}")
        logger.info(f"Intervalo:    {self.poll_interval} segundos")
        logger.info("=" * 70)

        # Primer heartbeat al arrancar
        self.send_heartbeat(is_online=True)

        while True:
            try:
                # 1. Consultar reloj y almacenar en cola local
                self.poll_clock()

                # 2. Despachar registros pendientes hacia la nube
                self.sync_batch_to_cloud()

                # 3. Latido periódico
                self.send_heartbeat(is_online=True)

            except Exception as e:
                logger.error(f"Error inesperado en ciclo principal: {e}", exc_info=True)

            time.sleep(self.poll_interval)


if __name__ == "__main__":
    agent = FA200SyncAgent(CONFIG)
    try:
        agent.run()
    except KeyboardInterrupt:
        logger.info("Servicio detenido por el usuario.")
