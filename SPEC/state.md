# 状態遷移図

## 照明の状態遷移（自動モード）

```mermaid
stateDiagram-v2
    [*] --> IDLE : 初期状態

    IDLE : IDLE（待機中）\n照明 OFF
    DEBOUNCE_ON : DEBOUNCE_ON（デバウンス中）\n照明 OFF・タイマー実行中
    OCCUPIED : OCCUPIED（在室）\n照明 ON・輝度自動調整
    WAIT_TIMER : WAIT_TIMER（離席待機）\n照明 ON・タイマー実行中
    OFF : OFF（消灯）\n照明 OFF

    IDLE --> DEBOUNCE_ON : センサー検知\n（any_detected 変化）
    DEBOUNCE_ON --> IDLE : デバウンス中に\n検知なしに戻る
    DEBOUNCE_ON --> OCCUPIED : デバウンス確定\n（N秒継続・消灯時間帯外）
    DEBOUNCE_ON --> OFF : デバウンス確定\n（消灯時間帯中）

    OCCUPIED --> WAIT_TIMER : センサー未検知確定\n（デバウンス N秒後）
    WAIT_TIMER --> OCCUPIED : 再検知（wait_task キャンセル）
    WAIT_TIMER --> OFF : タイマー満了（T秒）

    OFF --> DEBOUNCE_ON : センサー検知

    note right of DEBOUNCE_ON : debounce_sec: 1-10秒\n(デフォルト 2秒)
    note right of WAIT_TIMER : wait_sec: 0-3600秒\n(デフォルト 60秒)
```

---

## 手動モードの状態遷移

```mermaid
stateDiagram-v2
    Auto : 自動モード（auto）\nセンサー連動
    ManualON : 手動 ON（manual/on）\nセンサー無視
    ManualOFF : 手動 OFF（manual/off）\nセンサー無視

    Auto --> ManualON : POST /api/light/manual\n{status: "on"}
    Auto --> ManualOFF : POST /api/light/manual\n{status: "off"}
    ManualON --> ManualOFF : POST /api/light/manual\n{status: "off"}
    ManualOFF --> ManualON : POST /api/light/manual\n{status: "on"}
    ManualON --> Auto : POST /api/light/auto
    ManualOFF --> Auto : POST /api/light/auto
```

---

## 消灯スケジュール割り込み

```mermaid
stateDiagram-v2
    Active : 通常動作\n（自動 or 手動）
    Blackout : 消灯時間帯\n照明 OFF 強制

    Active --> Blackout : 消灯時間帯に入る\n（ScheduleChecker.is_blackout_now()）
    Blackout --> Active : 消灯時間帯終了\n（次のセンサーイベントで復帰）

    note right of Blackout : 手動モード中でも\n自動モード判定でのみ割り込み\n（手動モードには影響しない）
```

---

## asyncio タスクのライフサイクル

```mermaid
stateDiagram-v2
    state "debounce_task" as DT {
        [*] --> Running : create_task(sleep N)
        Running --> Done : N秒経過 → confirmed_any 更新
        Running --> Cancelled : 反対の検知 or 手動モード
        Done --> [*]
        Cancelled --> [*]
    }

    state "wait_task" as WT {
        [*] --> Running2 : create_task(sleep T)
        Running2 --> Done2 : T秒経過 → 照明 OFF
        Running2 --> Cancelled2 : 再検知 or 手動モード
        Done2 --> [*]
        Cancelled2 --> [*]
    }
```
