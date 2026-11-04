-- スマート照明デモ版: Cloudflare D1 の初期スキーマ。
-- 元の backend/db/schema.sql（SQLite）の5テーブルを、そのまま移植している。
-- 追加: runtime_states（旧 SessionState のメモリ上の状態を永続化したもの）。
--   旧実装はデバウンス・待機消灯・点灯時間をプロセス内の asyncio タスクで持っていたが、
--   Workers では常駐できないため、状態を本テーブルに保存して「アクセス時に期限を評価する」方式にした。

CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    last_seen  DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
    id            INTEGER PRIMARY KEY,
    session_id    TEXT    NOT NULL UNIQUE,
    debounce_sec  INTEGER NOT NULL DEFAULT 2,
    wait_sec      INTEGER NOT NULL DEFAULT 60,
    target_lux    INTEGER NOT NULL DEFAULT 300,
    power_watt    REAL    NOT NULL DEFAULT 10.0,
    blackout_from TEXT    DEFAULT NULL,
    blackout_to   TEXT    DEFAULT NULL,
    updated_at    DATETIME NOT NULL DEFAULT (datetime('now')),
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

-- 実行時状態（1セッション1行）。
--   sensors_json       : センサー3台の {detected, lux} の配列
--   confirmed_any      : デバウンス確定済みの在室判定（0/1）
--   pending_any        : デバウンス中の検知状態（NULL = デバウンス待ちなし）
--   pending_deadline_ms: デバウンス確定の期限（エポックミリ秒）
--   wait_deadline_ms   : 待機消灯の期限（エポックミリ秒、NULL = 待機なし）
--   on_since_ms        : 現在の点灯開始時刻（NULL = 消灯中）
--   total_on_minutes   : 点灯時間の累計（分）。旧 EnergyCalculator の _total_on_minutes
--   version            : 楽観ロック用のトークン。更新のたびに書き換える
CREATE TABLE IF NOT EXISTS runtime_states (
    session_id          TEXT     PRIMARY KEY,
    sensors_json        TEXT     NOT NULL DEFAULT '[{"detected":false,"lux":0},{"detected":false,"lux":0},{"detected":false,"lux":0}]',
    confirmed_any       INTEGER  NOT NULL DEFAULT 0,
    pending_any         INTEGER  DEFAULT NULL,
    pending_deadline_ms INTEGER  DEFAULT NULL,
    wait_deadline_ms    INTEGER  DEFAULT NULL,
    on_since_ms         INTEGER  DEFAULT NULL,
    total_on_minutes    REAL     NOT NULL DEFAULT 0,
    version             INTEGER  NOT NULL DEFAULT 0,
    updated_at          DATETIME NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_sensor_logs_session ON sensor_logs (session_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_energy_logs_session ON energy_logs (session_id, logged_at);
