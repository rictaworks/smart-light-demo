// セッション単位の照明制御ロジック（旧 backend/services/state_manager.py の SessionState と、
// sensor_service.py / light_controller.py の移植）。
//
// 旧実装はデバウンス・待機消灯を asyncio タスクで待っていたが、Workers では常駐できない。
// そこで期限（deadline）を状態として保存し、リクエストごとに advance() で期限切れ分を
// 時刻順に適用する。期限は「タスクを起動した時刻 + 秒数」で持つので、旧実装の asyncio.sleep と同じ長さになる。
//
// このクラスは I/O を持たない。変更は dirty フラグとログ配列に記録され、呼び出し側（repository）が保存する。

import { calcKwhSaved, calcKwhUsed, currentOnMinutes, roundTo } from "./energy";
import { isBlackout } from "./schedule";

export type Status = "on" | "off";
export type Mode = "auto" | "manual";
export type SensorIndex = 0 | 1 | 2;

export interface Settings {
  debounceSec: number;
  waitSec: number;
  targetLux: number;
  powerWatt: number;
  blackoutFrom: string | null;
  blackoutTo: string | null;
}

export interface SensorReading {
  detected: boolean;
  lux: number;
}

export type SensorReadings = [SensorReading, SensorReading, SensorReading];

export interface LightState {
  status: Status;
  brightness: number;
  mode: Mode;
}

export interface RuntimeState {
  sensors: SensorReadings;
  /** デバウンスで確定済みの在室判定（旧 confirmed_any） */
  confirmedAny: boolean;
  /** デバウンス待ちの検知状態。null は待ちなし。 */
  pending: { any: boolean; deadlineMs: number } | null;
  /** 待機消灯の期限。null は待機なし。 */
  waitDeadlineMs: number | null;
  /** 現在の点灯開始時刻。null は消灯中。 */
  onSinceMs: number | null;
  /** 点灯時間の累計（分） */
  totalOnMinutes: number;
}

export interface EnergyLogEntry {
  onMinutes: number;
  kwhUsed: number;
  kwhSaved: number;
}

export interface SensorLogEntry {
  sensorIndex: SensorIndex;
  detected: boolean;
  lux: number;
}

export const NUM_SENSORS = 3;
export const MAX_LUX = 1000;
/** 比例制御ゲイン（旧 light_controller.KP） */
export const KP = 0.1;
const MS_PER_SECOND = 1000;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 検知中のセンサーの照度平均（整数に切り捨て）。検知なしは 0。 */
export function averageLux(sensors: SensorReadings): number {
  const activeLux = sensors.filter((s) => s.detected).map((s) => s.lux);
  if (activeLux.length === 0) {
    return 0;
  }
  const sum = activeLux.reduce((total, lux) => total + lux, 0);
  return Math.trunc(sum / activeLux.length);
}

/** 照度差に比例して輝度を調整する（点灯中のみ、1〜100 に収める）。 */
export function adjustBrightness(light: LightState, currentLux: number, targetLux: number): void {
  if (light.status !== "on") {
    return;
  }
  const diff = targetLux - currentLux;
  const adjustment = Math.trunc(diff * KP);
  light.brightness = clamp(light.brightness + adjustment, 1, 100);
}

export function emptyRuntime(): RuntimeState {
  const sensor: SensorReading = { detected: false, lux: 0 };
  return {
    sensors: [{ ...sensor }, { ...sensor }, { ...sensor }],
    confirmedAny: false,
    pending: null,
    waitDeadlineMs: null,
    onSinceMs: null,
    totalOnMinutes: 0
  };
}

export class SessionMachine {
  /** 状態が変わったか（保存が必要か） */
  dirty = false;
  /** 設定が変わったか（settings テーブルの保存が必要か） */
  settingsDirty = false;
  readonly energyLogs: EnergyLogEntry[] = [];
  readonly sensorLogs: SensorLogEntry[] = [];

  constructor(
    public settings: Settings,
    public runtime: RuntimeState,
    public light: LightState
  ) {}

  /**
   * 期限が来ているデバウンス確定・待機消灯を、期限の早い順に適用する。
   * 旧実装の asyncio タスクが期限時刻に実行されたのと同じ結果になるよう、処理時刻は期限そのものを使う。
   */
  advance(nowMs: number): void {
    for (;;) {
      const debounceAt = this.runtime.pending?.deadlineMs ?? Infinity;
      const waitAt = this.runtime.waitDeadlineMs ?? Infinity;
      const nextAt = Math.min(debounceAt, waitAt);
      if (nextAt > nowMs) {
        return;
      }
      this.dirty = true;
      if (debounceAt <= waitAt) {
        this.confirmDebounce(debounceAt);
      } else {
        this.fireWait(waitAt);
      }
    }
  }

  /** センサー更新（旧 SessionState.process_sensor_update）。呼び出し前に advance() を済ませておくこと。 */
  sensorUpdate(nowMs: number, index: SensorIndex, detected: boolean, lux: number): void {
    this.dirty = true;
    const clampedLux = clamp(lux, 0, MAX_LUX);
    this.runtime.sensors[index] = { detected, lux: clampedLux };
    this.sensorLogs.push({ sensorIndex: index, detected, lux });

    const anyDetected = this.runtime.sensors.some((s) => s.detected);
    if (anyDetected === this.runtime.confirmedAny) {
      // 確定状態と同じ → 未確定のデバウンスは取り消す
      this.runtime.pending = null;
      return;
    }
    // 確定状態と違う → デバウンスを（再）開始する
    this.runtime.pending = {
      any: anyDetected,
      deadlineMs: nowMs + this.settings.debounceSec * MS_PER_SECOND
    };
  }

  /** 手動制御（旧 SessionState.set_manual）。待機処理は取り消す。 */
  setManual(nowMs: number, status: Status, brightness: number): void {
    this.dirty = true;
    this.runtime.pending = null;
    this.runtime.waitDeadlineMs = null;

    if (status === "off" && this.light.status === "on") {
      this.recordOff(nowMs);
      this.logEnergy(nowMs);
    } else if (status === "on" && this.light.status === "off") {
      this.recordOn(nowMs);
    }
    this.light.mode = "manual";
    this.light.status = status;
    this.light.brightness = clamp(brightness, 0, 100);
  }

  /** 自動モード復帰（旧 SessionState.set_auto）。 */
  setAuto(nowMs: number): void {
    this.dirty = true;
    this.light.mode = "auto";
    this.applyLightControl(nowMs);
  }

  /**
   * 設定の更新（旧 SessionState.update_settings）。
   * 旧実装は消費電力が変わると EnergyCalculator を作り直しており、累計と点灯開始時刻が失われていた。その挙動を残す。
   */
  updateSettings(next: Settings): void {
    this.dirty = true;
    this.settingsDirty = true;
    if (next.powerWatt !== this.settings.powerWatt) {
      this.runtime.totalOnMinutes = 0;
      this.runtime.onSinceMs = null;
    }
    this.settings = next;
  }

  /** 省エネのスナップショット（旧 get_energy_snapshot）。 */
  energySnapshot(nowMs: number): { onMinutes: number; kwhUsed: number; kwhSaved: number } {
    const minutes = currentOnMinutes(this.runtime.totalOnMinutes, this.runtime.onSinceMs, nowMs);
    return {
      onMinutes: roundTo(minutes, 2),
      kwhUsed: calcKwhUsed(this.settings.powerWatt, minutes),
      kwhSaved: calcKwhSaved(this.settings.powerWatt, minutes)
    };
  }

  private confirmDebounce(atMs: number): void {
    const pending = this.runtime.pending;
    if (pending === null) {
      throw new Error("デバウンス確定の期限がありますが、待ち状態がありません");
    }
    this.runtime.pending = null;
    this.runtime.confirmedAny = pending.any;
    this.applyLightControl(atMs);
  }

  private fireWait(atMs: number): void {
    this.runtime.waitDeadlineMs = null;
    this.turnOff(atMs);
  }

  /** 旧 SessionState._apply_light_control */
  private applyLightControl(atMs: number): void {
    if (this.light.mode === "manual") {
      return;
    }
    if (isBlackout(this.settings.blackoutFrom, this.settings.blackoutTo, atMs)) {
      this.turnOff(atMs);
      return;
    }
    if (this.runtime.confirmedAny) {
      this.runtime.waitDeadlineMs = null;
      this.turnOn(atMs);
      return;
    }
    // 離席 → 待機タイマーを開始（既に動いていれば何もしない）
    if (this.runtime.waitDeadlineMs === null) {
      this.runtime.waitDeadlineMs = atMs + this.settings.waitSec * MS_PER_SECOND;
    }
  }

  /** 旧 SessionState._do_turn_on */
  private turnOn(atMs: number): void {
    const wasOff = this.light.status === "off";
    const avgLux = averageLux(this.runtime.sensors);
    if (this.light.mode === "auto") {
      this.light.status = "on";
    }
    adjustBrightness(this.light, avgLux, this.settings.targetLux);
    if (wasOff) {
      this.recordOn(atMs);
    }
  }

  /** 旧 SessionState._do_turn_off */
  private turnOff(atMs: number): void {
    const wasOn = this.light.status === "on";
    if (this.light.mode === "auto") {
      this.light.status = "off";
    }
    if (wasOn) {
      this.recordOff(atMs);
      this.logEnergy(atMs);
    }
  }

  private recordOn(atMs: number): void {
    if (this.runtime.onSinceMs === null) {
      this.runtime.onSinceMs = atMs;
    }
  }

  private recordOff(atMs: number): void {
    if (this.runtime.onSinceMs !== null) {
      this.runtime.totalOnMinutes += Math.max(0, (atMs - this.runtime.onSinceMs) / 60_000);
      this.runtime.onSinceMs = null;
    }
  }

  /** 旧 SessionState._save_energy_log。値は消灯の時点の累計。 */
  private logEnergy(atMs: number): void {
    const minutes = currentOnMinutes(this.runtime.totalOnMinutes, this.runtime.onSinceMs, atMs);
    this.energyLogs.push({
      onMinutes: minutes,
      kwhUsed: calcKwhUsed(this.settings.powerWatt, minutes),
      kwhSaved: calcKwhSaved(this.settings.powerWatt, minutes)
    });
  }
}
