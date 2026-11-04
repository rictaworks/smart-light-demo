// 省エネ計算（旧 backend/services/energy_calculator.py の移植）。
// 仕様 F7: 消費電力量(Wh) = ON時間(h) × 消費電力(W)、節約量 = 常時ON想定量 − 実消費量。

const MS_PER_MINUTE = 60_000;
export const ASSUME_HOURS_PER_DAY = 24;

/** Python の round(value, digits) に相当する丸め。 */
export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** 現時点までの点灯時間（分）。旧 current_on_minutes。 */
export function currentOnMinutes(
  totalOnMinutes: number,
  onSinceMs: number | null,
  nowMs: number
): number {
  if (onSinceMs === null) {
    return totalOnMinutes;
  }
  return totalOnMinutes + Math.max(0, (nowMs - onSinceMs) / MS_PER_MINUTE);
}

/** 消費電力量（kWh、小数6桁）。旧 calc_kwh_used。 */
export function calcKwhUsed(powerWatt: number, onMinutes: number): number {
  const onHours = onMinutes / 60;
  return roundTo((powerWatt * onHours) / 1000, 6);
}

/** 節約電力量（kWh、小数6桁）。旧 calc_kwh_saved。 */
export function calcKwhSaved(powerWatt: number, onMinutes: number): number {
  const alwaysOn = (powerWatt * ASSUME_HOURS_PER_DAY) / 1000;
  return roundTo(Math.max(0, alwaysOn - calcKwhUsed(powerWatt, onMinutes)), 6);
}
