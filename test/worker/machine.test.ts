import { describe, expect, it } from "vitest";
import {
  SessionMachine,
  emptyRuntime,
  type LightState,
  type Settings
} from "../../worker/src/domain/machine";

// 2026-11-04 21:00 JST（UTC 12:00）を基準時刻にする。
const T0 = Date.UTC(2026, 10, 4, 12, 0, 0);
const SEC = 1000;
const MIN = 60 * SEC;

function settingsWith(overrides: Partial<Settings> = {}): Settings {
  return {
    debounceSec: 2,
    waitSec: 60,
    targetLux: 300,
    powerWatt: 10,
    blackoutFrom: null,
    blackoutTo: null,
    ...overrides
  };
}

function machineWith(
  settings: Settings = settingsWith(),
  light: LightState = { status: "off", brightness: 70, mode: "auto" }
): SessionMachine {
  return new SessionMachine(settings, emptyRuntime(), light);
}

/** 指定時刻に指定センサーを検知させ、デバウンスの期限まで進める。 */
function detectAndConfirm(m: SessionMachine, atMs: number, lux: number, sensorIndex: 0 | 1 | 2 = 0): number {
  m.advance(atMs);
  m.sensorUpdate(atMs, sensorIndex, true, lux);
  const confirmAt = atMs + m.settings.debounceSec * SEC;
  m.advance(confirmAt);
  return confirmAt;
}

describe("センサー → 照明制御（デバウンス）", () => {
  it("検知が確定（デバウンス秒数経過）するまで点灯しない（T01）", () => {
    const m = machineWith();
    m.sensorUpdate(T0, 0, true, 200);
    m.advance(T0 + 1 * SEC);
    expect(m.light.status).toBe("off");
    m.advance(T0 + 2 * SEC);
    expect(m.light.status).toBe("on");
  });

  it("デバウンス未満のノイズは無視する（T09）", () => {
    const m = machineWith();
    m.sensorUpdate(T0, 0, true, 200);
    m.sensorUpdate(T0 + 1 * SEC, 0, false, 0);
    m.advance(T0 + 10 * SEC);
    expect(m.light.status).toBe("off");
    expect(m.runtime.pending).toBeNull();
  });

  it("確定後の状態変化は、デバウンス期間を経て反映される（T10）", () => {
    const m = machineWith();
    detectAndConfirm(m, T0, 200);
    expect(m.light.status).toBe("on");
    m.sensorUpdate(T0 + 5 * SEC, 0, false, 0);
    m.advance(T0 + 5 * SEC + 1 * SEC);
    expect(m.runtime.confirmedAny).toBe(true);
    m.advance(T0 + 5 * SEC + 2 * SEC);
    expect(m.runtime.confirmedAny).toBe(false);
  });

  it("デバウンス中に同じ状態の更新が来ると期限は取り直す", () => {
    const m = machineWith();
    m.sensorUpdate(T0, 0, true, 200);
    m.sensorUpdate(T0 + 1500, 0, true, 250);
    m.advance(T0 + 2 * SEC);
    expect(m.light.status).toBe("off");
    m.advance(T0 + 1500 + 2 * SEC);
    expect(m.light.status).toBe("on");
  });
});

describe("離席 → 待機消灯", () => {
  it("離席後は待機時間が経過してから消灯する（T02）", () => {
    const m = machineWith();
    const onAt = detectAndConfirm(m, T0, 300);
    m.sensorUpdate(onAt, 0, false, 0);
    const leftAt = onAt + 2 * SEC; // 離席の確定
    m.advance(leftAt);
    expect(m.light.status).toBe("on");
    m.advance(leftAt + 60 * SEC - 1);
    expect(m.light.status).toBe("on");
    m.advance(leftAt + 60 * SEC);
    expect(m.light.status).toBe("off");
  });

  it("待機中に再検知すると消灯せず、タイマーは取り消される（T03）", () => {
    const m = machineWith();
    const onAt = detectAndConfirm(m, T0, 300);
    m.sensorUpdate(onAt, 0, false, 0);
    m.advance(onAt + 2 * SEC);
    m.sensorUpdate(onAt + 30 * SEC, 0, true, 300);
    m.advance(onAt + 32 * SEC);
    expect(m.runtime.waitDeadlineMs).toBeNull();
    m.advance(onAt + 200 * SEC);
    expect(m.light.status).toBe("on");
  });

  it("待機時間 0 秒なら、確定と同時に消灯する", () => {
    const m = machineWith(settingsWith({ waitSec: 0 }));
    const onAt = detectAndConfirm(m, T0, 300);
    m.sensorUpdate(onAt, 0, false, 0);
    m.advance(onAt + 2 * SEC);
    expect(m.light.status).toBe("off");
  });
});

describe("輝度の自動調整（P 制御）", () => {
  it("照度が目標より高いと輝度を下げる（T06）", () => {
    const m = machineWith();
    detectAndConfirm(m, T0, 600);
    expect(m.light.brightness).toBe(40);
  });

  it("照度が目標より低いと輝度を上げる（T07）", () => {
    const m = machineWith();
    detectAndConfirm(m, T0, 100);
    expect(m.light.brightness).toBe(90);
  });

  it("目標照度と一致すると輝度は変わらない（T08）", () => {
    const m = machineWith();
    detectAndConfirm(m, T0, 300);
    expect(m.light.brightness).toBe(70);
  });

  it("複数センサー検知時は検知中センサーの照度平均を使う（T20）", () => {
    const m = machineWith();
    m.sensorUpdate(T0, 0, true, 100);
    m.sensorUpdate(T0 + 500, 1, true, 500);
    m.advance(T0 + 500 + 2 * SEC);
    expect(m.light.status).toBe("on");
    // 平均 300 → 目標と一致 → 輝度は 70 のまま
    expect(m.light.brightness).toBe(70);
  });
});

describe("手動制御と自動復帰", () => {
  it("手動 OFF 中はセンサー検知しても点灯しない（T14）", () => {
    const m = machineWith();
    m.setManual(T0, "off", 70);
    detectAndConfirm(m, T0 + 1 * SEC, 300);
    expect(m.light.status).toBe("off");
  });

  it("手動 ON 中は無検知になっても消灯しない（T15）", () => {
    const m = machineWith();
    m.setManual(T0, "on", 80);
    m.sensorUpdate(T0 + 1 * SEC, 0, false, 0);
    m.advance(T0 + 1000 * SEC);
    expect(m.light.status).toBe("on");
    expect(m.light.brightness).toBe(80);
  });

  it("手動制御は待機中のタイマーを取り消す", () => {
    const m = machineWith();
    const onAt = detectAndConfirm(m, T0, 300);
    m.sensorUpdate(onAt, 0, false, 0);
    m.advance(onAt + 2 * SEC);
    expect(m.runtime.waitDeadlineMs).not.toBeNull();
    m.setManual(onAt + 3 * SEC, "on", 70);
    expect(m.runtime.waitDeadlineMs).toBeNull();
  });

  it("自動モードに戻すと、現在のセンサー状態で制御される（T16）", () => {
    const m = machineWith();
    m.setManual(T0, "off", 70);
    m.sensorUpdate(T0 + 1 * SEC, 0, true, 300);
    m.setAuto(T0 + 2 * SEC);
    expect(m.light.mode).toBe("auto");
    // 在室の確定はまだ（デバウンス中）なので、確定後に点灯する
    m.advance(T0 + 3 * SEC);
    expect(m.light.status).toBe("on");
  });
});

describe("消灯スケジュール", () => {
  // JST の時刻を UTC のエポックミリ秒にする（2026-11-04）
  const jst = (hour: number, minute: number) => Date.UTC(2026, 10, 4, hour - 9, minute);

  it("消灯時間帯中は検知しても点灯しない（T04）", () => {
    const m = machineWith(settingsWith({ blackoutFrom: "22:00", blackoutTo: "07:00" }));
    detectAndConfirm(m, jst(23, 0), 300);
    expect(m.light.status).toBe("off");
  });

  it("消灯時間帯の終了時刻ちょうどの検知で点灯する（T05）", () => {
    const m = machineWith(settingsWith({ blackoutFrom: "22:00", blackoutTo: "07:00" }));
    detectAndConfirm(m, jst(7, 0), 300);
    expect(m.light.status).toBe("on");
  });
});

describe("省エネ記録", () => {
  it("点灯時間と消費電力量・節約量を消灯時に記録する（T11, T12）", () => {
    const m = machineWith();
    const onAt = detectAndConfirm(m, T0, 300);
    m.setManual(onAt + 6 * MIN, "off", 70);

    expect(m.energyLogs).toHaveLength(1);
    const log = m.energyLogs[0];
    expect(log?.onMinutes).toBeCloseTo(6, 6);
    // 10W × 0.1h = 1Wh = 0.001kWh、常時ON想定 0.24kWh との差 0.239kWh
    expect(log?.kwhUsed).toBeCloseTo(0.001, 6);
    expect(log?.kwhSaved).toBeCloseTo(0.239, 6);
  });

  it("点灯中のスナップショットは現在時刻までの時間を含む", () => {
    const m = machineWith();
    const onAt = detectAndConfirm(m, T0, 300);
    const snapshot = m.energySnapshot(onAt + 3 * MIN);
    expect(snapshot.onMinutes).toBeCloseTo(3, 2);
  });

  it("消費電力を変えると累計がリセットされる（旧 EnergyCalculator の再生成と同じ挙動）", () => {
    const m = machineWith();
    const onAt = detectAndConfirm(m, T0, 300);
    m.setManual(onAt + 6 * MIN, "off", 70);
    expect(m.runtime.totalOnMinutes).toBeCloseTo(6, 6);
    m.updateSettings(settingsWith({ powerWatt: 20 }));
    expect(m.runtime.totalOnMinutes).toBe(0);
    expect(m.runtime.onSinceMs).toBeNull();
  });
});

describe("advance の挙動", () => {
  it("期限が来ていなければ何も変えない（dirty にならない）", () => {
    const m = machineWith();
    m.advance(T0);
    expect(m.dirty).toBe(false);
  });

  it("デバウンス確定と待機期限が同じ呼び出しで連続して処理される", () => {
    const m = machineWith(settingsWith({ debounceSec: 1, waitSec: 0 }));
    m.sensorUpdate(T0, 0, true, 300);
    m.advance(T0 + 1 * SEC);
    expect(m.light.status).toBe("on");
    m.sensorUpdate(T0 + 2 * SEC, 0, false, 0);
    m.advance(T0 + 3 * SEC);
    expect(m.light.status).toBe("off");
  });
});
