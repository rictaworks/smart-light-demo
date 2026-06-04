# ER 図

```mermaid
erDiagram
    sessions {
        TEXT id PK
        DATETIME created_at
        DATETIME last_seen
    }

    settings {
        INTEGER id PK
        TEXT session_id FK
        INTEGER debounce_sec "デバウンス秒 (1-10, default 2)"
        INTEGER wait_sec "待機秒 (0-3600, default 60)"
        INTEGER target_lux "目標照度 (0-1000, default 300)"
        REAL power_watt "消費電力W (default 10.0)"
        TEXT blackout_from "消灯開始 HH:MM / NULL"
        TEXT blackout_to "消灯終了 HH:MM / NULL"
        DATETIME updated_at
    }

    light_states {
        INTEGER id PK
        TEXT session_id FK
        TEXT status "on / off"
        INTEGER brightness "0-100"
        TEXT mode "auto / manual"
        DATETIME updated_at
    }

    sensor_logs {
        INTEGER id PK "AUTOINCREMENT"
        TEXT session_id FK
        INTEGER sensor_index "0, 1, 2"
        INTEGER detected "0 / 1"
        INTEGER lux "0-1000"
        DATETIME recorded_at
    }

    energy_logs {
        INTEGER id PK "AUTOINCREMENT"
        TEXT session_id FK
        REAL on_minutes "累積ON時間（分）"
        REAL kwh_used "消費電力量"
        REAL kwh_saved "節約電力量"
        DATETIME logged_at
    }

    sessions ||--o| settings : "1:1"
    sessions ||--o| light_states : "1:1"
    sessions ||--o{ sensor_logs : "1:N"
    sessions ||--o{ energy_logs : "1:N"
```

## 設計上の注意点

- `settings` / `light_states` は session ごとに 1 行（UNIQUE(session_id)）
- `sensor_logs` / `energy_logs` は追記のみ（更新・削除なし）
- 全クエリに `WHERE session_id = ?` を付与してセッション分離を保証
- マスタデータ（制御モード・照明状態・センサー状態の定数）は DB に保存せずコード内定数で管理
- JST 03:00 に全テーブルの全行を削除（`DELETE FROM ...` 順は FK 制約を考慮）
