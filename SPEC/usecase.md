# ユースケース図

## ユーザーユースケース

```mermaid
graph TD
    User(["ユーザー"])

    subgraph System["スマート照明デモシステム"]
        UC1["UC1\nセンサー状態をシミュレートする\n(3センサー独立 ON/OFF・照度スライダー)"]
        UC2["UC2\n照明を自動制御する\n(センサー連動・デバウンス・待機タイマー)"]
        UC3["UC3\n輝度を自動調整する\n(照度センサー値 × P制御)"]
        UC4["UC4\n手動で照明を ON/OFF・輝度変更する"]
        UC5["UC5\n自動モードに復帰する"]
        UC6["UC6\n消灯スケジュールを設定する\n(開始〜終了 HH:MM)"]
        UC7["UC7\n省エネ状況を確認する\n(ON時間・kWh・節約量・グラフ)"]
        UC8["UC8\n設定を変更する\n(デバウンス秒・待機秒・目標照度・消費電力)"]
        UC9["UC9\nDBを手動リセットする"]
    end

    User --> UC1
    User --> UC4
    User --> UC6
    User --> UC7
    User --> UC8
    User --> UC9

    UC1 -->|"extends"| UC2
    UC2 -->|"extends"| UC3
    UC4 -->|"includes"| UC5
```

---

## システム自動処理ユースケース

```mermaid
graph TD
    subgraph AutoSystem["システム自動処理"]
        UC10["UC10\nDBを毎日自動リセットする\n(APScheduler / JST 03:00)"]
        UC11["UC11\nセッションを分離する\n(全クエリに WHERE session_id = ? を付与)"]
        UC12["UC12\nデバウンス処理\n(asyncio: sleep debounce_sec)"]
        UC13["UC13\n待機タイマー処理\n(asyncio: sleep wait_sec)"]
        UC14["UC14\n消灯時間帯チェック\n(ScheduleChecker)"]
    end
```

---

## API ユースケースマッピング

| ユースケース | API エンドポイント | 実装クラス |
|---|---|---|
| UC1 センサーシミュレート | `POST /api/sensor` | `SensorService.update()` |
| UC2 照明自動制御 | (asyncio タスク) | `SessionState._apply_light_control()` |
| UC3 輝度自動調整 | (UC2 内) | `LightController.adjust_brightness()` |
| UC4 手動制御 | `POST /api/light/manual` | `SessionState.set_manual()` |
| UC5 自動復帰 | `POST /api/light/auto` | `SessionState.set_auto()` |
| UC6 消灯スケジュール | `PUT /api/settings` | `ScheduleChecker.is_blackout_now()` |
| UC7 省エネ確認 | `GET /api/energy` | `EnergyCalculator.calc_*()` |
| UC8 設定変更 | `PUT /api/settings` | `SessionRepository.update_settings()` |
| UC9 手動リセット | `POST /api/admin/reset` | `reset_all_data()` |
| UC10 自動リセット | (APScheduler Cron) | `tasks/db_reset.py` |
| UC11 セッション分離 | 全エンドポイント | `SessionRepository._sid` フィルタ |
| UC12 デバウンス | `POST /api/sensor` 後 | `asyncio.create_task(sleep N)` |
| UC13 待機タイマー | (UC2 内) | `asyncio.create_task(sleep T)` |
| UC14 消灯時間帯 | (UC2 内) | `ScheduleChecker.is_blackout_now()` |
