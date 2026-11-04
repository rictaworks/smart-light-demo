import { describe, expect, it } from "vitest";
import { HttpError } from "../../worker/src/errors";
import {
  parseManualControl,
  parseSensorUpdate,
  parseSettingsUpdate
} from "../../worker/src/validation";

/** 関数が投げた HttpError のステータスを返す（投げなければ undefined）。 */
function statusOf(fn: () => unknown): number | undefined {
  try {
    fn();
    return undefined;
  } catch (error) {
    return error instanceof HttpError ? error.status : undefined;
  }
}

describe("センサー更新の検証", () => {
  it("正しい値は通る", () => {
    expect(parseSensorUpdate({ sensor_index: 2, detected: true, lux: 1000 })).toEqual({
      sensorIndex: 2,
      detected: true,
      lux: 1000
    });
  });

  it("sensor_index が 0〜2 の外、または lux が範囲外なら 422", () => {
    expect(statusOf(() => parseSensorUpdate({ sensor_index: 5, detected: true, lux: 100 }))).toBe(422);
    expect(statusOf(() => parseSensorUpdate({ sensor_index: 0, detected: true, lux: 1001 }))).toBe(422);
    expect(statusOf(() => parseSensorUpdate({ sensor_index: 0, detected: "yes", lux: 1 }))).toBe(422);
    expect(statusOf(() => parseSensorUpdate([]))).toBe(422);
  });
});

describe("手動制御の検証", () => {
  it("status は on / off のみ、brightness は 0〜100", () => {
    expect(parseManualControl({ status: "on", brightness: 80 })).toEqual({ status: "on", brightness: 80 });
    expect(statusOf(() => parseManualControl({ status: "auto", brightness: 80 }))).toBe(422);
    expect(statusOf(() => parseManualControl({ status: "on", brightness: 101 }))).toBe(422);
  });
});

describe("設定更新の検証", () => {
  it("未指定と null の項目は含めない（変更しない）", () => {
    expect(parseSettingsUpdate({ debounce_sec: 5, wait_sec: null, blackout_from: null })).toEqual({
      debounceSec: 5
    });
  });

  it("範囲と形式を検査する", () => {
    expect(statusOf(() => parseSettingsUpdate({ debounce_sec: 0 }))).toBe(422);
    expect(statusOf(() => parseSettingsUpdate({ wait_sec: 3601 }))).toBe(422);
    expect(statusOf(() => parseSettingsUpdate({ power_watt: 0 }))).toBe(422);
    expect(statusOf(() => parseSettingsUpdate({ blackout_from: "24:00" }))).toBe(422);
    expect(statusOf(() => parseSettingsUpdate({ blackout_to: "" }))).toBe(422);
  });

  it("時刻は HH:MM を受け付ける", () => {
    expect(parseSettingsUpdate({ blackout_from: "22:00", blackout_to: "07:00" })).toEqual({
      blackoutFrom: "22:00",
      blackoutTo: "07:00"
    });
  });
});
