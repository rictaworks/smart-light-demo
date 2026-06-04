CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    last_seen  DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
    id             INTEGER PRIMARY KEY,
    session_id     TEXT    NOT NULL UNIQUE,
    debounce_sec   INTEGER NOT NULL DEFAULT 2,
    wait_sec       INTEGER NOT NULL DEFAULT 60,
    target_lux     INTEGER NOT NULL DEFAULT 300,
    power_watt     REAL    NOT NULL DEFAULT 10.0,
    blackout_from  TEXT    DEFAULT NULL,
    blackout_to    TEXT    DEFAULT NULL,
    updated_at     DATETIME NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS light_states (
    id         INTEGER PRIMARY KEY,
    session_id TEXT    NOT NULL UNIQUE,
    status     TEXT    NOT NULL DEFAULT 'off',
    brightness INTEGER NOT NULL DEFAULT 70,
    mode       TEXT    NOT NULL DEFAULT 'auto',
    updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS sensor_logs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id   TEXT    NOT NULL,
    sensor_index INTEGER NOT NULL,
    detected     INTEGER NOT NULL,
    lux          INTEGER NOT NULL DEFAULT 0,
    recorded_at  DATETIME NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS energy_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT  NOT NULL,
    on_minutes REAL  NOT NULL DEFAULT 0,
    kwh_used   REAL  NOT NULL DEFAULT 0,
    kwh_saved  REAL  NOT NULL DEFAULT 0,
    logged_at  DATETIME NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);
