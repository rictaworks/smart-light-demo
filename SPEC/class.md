# クラス図

```mermaid
classDiagram
    class SensorService {
        -list~bool~ _detected
        -list~int~ _lux
        +update(index int, detected bool, lux int) None
        +is_any_detected() bool
        +get_average_lux() int
        +get_states() list~dict~
    }

    class LightController {
        -str _status
        -int _brightness
        -str _mode
        +set_manual(status str, brightness int) None
        +set_auto() None
        +turn_on() None
        +turn_off() None
        +adjust_brightness(current_lux int, target_lux int) None
        +is_manual_mode() bool
        +to_dict() dict
    }

    class EnergyCalculator {
        -float _power
        -datetime _on_since
        -float _total_on_minutes
        +record_on(ts datetime) None
        +record_off(ts datetime) None
        +current_on_minutes(now datetime) float
        +calc_kwh_used(now datetime) float
        +calc_kwh_saved(now datetime) float
    }

    class ScheduleChecker {
        -time _from
        -time _to
        -_parse(t str) time
        +is_blackout_now() bool
    }

    class SessionState {
        +str sid
        +SensorService sensor
        +LightController light
        +EnergyCalculator energy
        -bool confirmed_any
        -Task debounce_task
        -Task wait_task
        -int _debounce_sec
        -int _wait_sec
        -int _target_lux
        -float _power_watt
        -str _blackout_from
        -str _blackout_to
        +set_callbacks(on_light_change, on_energy_log) None
        +update_settings(settings dict) None
        +process_sensor_update(index int, detected bool, lux int) None
        +set_manual(status str, brightness int) None
        +set_auto() None
        +get_energy_snapshot() dict
        +cancel_tasks() None
        -_debounce_then_apply(new_any bool) None
        -_apply_light_control() None
        -_wait_then_off() None
        -_do_turn_on() None
        -_do_turn_off() None
        -_persist_light() None
        -_save_energy_log(now datetime) None
    }

    class StateManager {
        -dict~str_SessionState~ _states
        +get_or_create(session_id str, settings dict, light dict) SessionState
        +get(session_id str) SessionState
        +remove(session_id str) None
        +clear_all() None
    }

    class SessionRepository {
        -str _sid
        -_conn() Connection
        +create_session() None
        +touch_session() None
        +session_exists() bool
        +get_settings() dict
        +update_settings(**kwargs) None
        +get_light_state() dict
        +save_light_state(status str, brightness int, mode str) None
        +append_sensor_log(index int, detected bool, lux int) None
        +append_energy_log(on_min float, kwh_used float, kwh_saved float) None
        +get_energy_logs(hours int) list~dict~
    }

    SessionState *-- SensorService
    SessionState *-- LightController
    SessionState *-- EnergyCalculator
    SessionState --> ScheduleChecker : creates
    StateManager *-- SessionState : manages

    SessionState --> SessionRepository : callback
```

## 設計方針

| クラス | 責務 |
|---|---|
| `SensorService` | 3センサーの raw 状態を保持・集約 |
| `LightController` | 照明の状態遷移・P制御輝度調整 |
| `EnergyCalculator` | ON/OFF 時刻から kWh を計算 |
| `ScheduleChecker` | 現在時刻が消灯時間帯かを判定（日またぎ対応） |
| `SessionState` | セッションごとの in-memory ステートマシン（asyncio タスク管理） |
| `StateManager` | SessionState のグローバルレジストリ（シングルトン） |
| `SessionRepository` | SQLite への全 DB 操作（session_id フィルタ必須） |
