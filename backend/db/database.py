import sqlite3
import logging
from pathlib import Path
from backend.config import DATABASE_URL

logger = logging.getLogger(__name__)
SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DATABASE_URL, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    conn = get_connection()
    try:
        with conn:
            conn.executescript(SCHEMA_PATH.read_text())
        logger.info("Database initialized")
    finally:
        conn.close()


def reset_all_data(conn: sqlite3.Connection) -> None:
    with conn:
        conn.execute("DELETE FROM energy_logs")
        conn.execute("DELETE FROM sensor_logs")
        conn.execute("DELETE FROM light_states")
        conn.execute("DELETE FROM settings")
        conn.execute("DELETE FROM sessions")
