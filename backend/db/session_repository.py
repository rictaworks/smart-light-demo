import sqlite3
import logging
from .database import get_connection

logger = logging.getLogger(__name__)


class SessionRepository:
    def __init__(self, session_id: str):
        self._sid = session_id

    def _conn(self) -> sqlite3.Connection:
        return get_connection()

    # ── セッション ──────────────────────────────────────────────
    def create_session(self) -> None:
        conn = self._conn()
        try:
            with conn:
                conn.execute(
                    "INSERT OR IGNORE INTO sessions (id) VALUES (?)", (self._sid,)
                )
                conn.execute(
                    "INSERT OR IGNORE INTO settings (session_id) VALUES (?)", (self._sid,)
                )
                conn.execute(
                    "INSERT OR IGNORE INTO light_states (session_id) VALUES (?)", (self._sid,)
                )
        finally:
            conn.close()

    def touch_session(self) -> None:
        conn = self._conn()
        try:
            with conn:
                conn.execute(
                    "UPDATE sessions SET last_seen = datetime('now') WHERE id = ?",
                    (self._sid,),
                )
        finally:
            conn.close()

    def session_exists(self) -> bool:
        conn = self._conn()
        try:
            row = conn.execute(
                "SELECT 1 FROM sessions WHERE id = ?", (self._sid,)
            ).fetchone()
            return row is not None
        finally:
            conn.close()

    # ── 設定 ────────────────────────────────────────────────────
    def get_settings(self) -> dict:
        conn = self._conn()
        try:
            row = conn.execute(
                "SELECT * FROM settings WHERE session_id = ?", (self._sid,)
            ).fetchone()
            if not row:
                return {
                    "debounce_sec": 2,
                    "wait_sec": 60,
                    "target_lux": 300,
                    "power_watt": 10.0,
                    "blackout_from": None,
                    "blackout_to": None,
                }
            return dict(row)
        finally:
            conn.close()

    def update_settings(self, **kwargs) -> None:
        allowed = {"debounce_sec", "wait_sec", "target_lux", "power_watt", "blackout_from", "blackout_to"}
        fields = {k: v for k, v in kwargs.items() if k in allowed}
        if not fields:
            return
        set_clause = ", ".join(f"{k} = ?" for k in fields)
        values = list(fields.values()) + [self._sid]
        conn = self._conn()
        try:
            with conn:
                conn.execute(
                    f"UPDATE settings SET {set_clause}, updated_at = datetime('now') WHERE session_id = ?",
                    values,
                )
        finally:
            conn.close()

    # ── 照明状態 ─────────────────────────────────────────────────
    def get_light_state(self) -> dict:
        conn = self._conn()
        try:
            row = conn.execute(
                "SELECT status, brightness, mode FROM light_states WHERE session_id = ?",
                (self._sid,),
            ).fetchone()
            return dict(row) if row else {"status": "off", "brightness": 70, "mode": "auto"}
        finally:
            conn.close()

    def save_light_state(self, status: str, brightness: int, mode: str) -> None:
        conn = self._conn()
        try:
            with conn:
                conn.execute(
                    "UPDATE light_states SET status = ?, brightness = ?, mode = ?, updated_at = datetime('now') WHERE session_id = ?",
                    (status, brightness, mode, self._sid),
                )
        finally:
            conn.close()

    # ── センサーログ ─────────────────────────────────────────────
    def append_sensor_log(self, sensor_index: int, detected: bool, lux: int) -> None:
        conn = self._conn()
        try:
            with conn:
                conn.execute(
                    "INSERT INTO sensor_logs (session_id, sensor_index, detected, lux) VALUES (?, ?, ?, ?)",
                    (self._sid, sensor_index, int(detected), lux),
                )
        finally:
            conn.close()

    # ── エネルギーログ ───────────────────────────────────────────
    def append_energy_log(self, on_minutes: float, kwh_used: float, kwh_saved: float) -> None:
        conn = self._conn()
        try:
            with conn:
                conn.execute(
                    "INSERT INTO energy_logs (session_id, on_minutes, kwh_used, kwh_saved) VALUES (?, ?, ?, ?)",
                    (self._sid, on_minutes, kwh_used, kwh_saved),
                )
        finally:
            conn.close()

    def get_energy_logs(self, hours: int = 24) -> list[dict]:
        conn = self._conn()
        try:
            rows = conn.execute(
                """SELECT on_minutes, kwh_used, kwh_saved, logged_at
                   FROM energy_logs
                   WHERE session_id = ?
                   AND logged_at >= datetime('now', ?)
                   ORDER BY logged_at ASC""",
                (self._sid, f"-{hours} hours"),
            ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()
