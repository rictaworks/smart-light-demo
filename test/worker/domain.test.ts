import { describe, expect, it } from "vitest";
import { calcKwhSaved, calcKwhUsed, currentOnMinutes } from "../../worker/src/domain/energy";
import { isBlackout, jstMinuteOfDay } from "../../worker/src/domain/schedule";

// JST の時刻を UTC のエポックミリ秒にする（2026-11-04）
const jst = (hour: number, minute: number) => Date.UTC(2026, 10, 4, hour - 9, minute);

describe("消灯時間帯の判定", () => {
  it("日をまたぐ時間帯（22:00〜07:00）の内側と外側を判定する", () => {
    expect(isBlackout("22:00", "07:00", jst(23, 0))).toBe(true);
    expect(isBlackout("22:00", "07:00", jst(6, 59))).toBe(true);
    expect(isBlackout("22:00", "07:00", jst(7, 0))).toBe(false);
    expect(isBlackout("22:00", "07:00", jst(12, 0))).toBe(false);
  });

  it("日をまたがない時間帯（00:00〜06:00）を判定する", () => {
    expect(isBlackout("00:00", "06:00", jst(0, 0))).toBe(true);
    expect(isBlackout("00:00", "06:00", jst(5, 59))).toBe(true);
    expect(isBlackout("00:00", "06:00", jst(6, 0))).toBe(false);
  });

  it("どちらかが未設定なら消灯時間帯ではない", () => {
    expect(isBlackout(null, "07:00", jst(3, 0))).toBe(false);
    expect(isBlackout("22:00", null, jst(23, 0))).toBe(false);
  });

  it("JST の時分で判定する（UTC では前日でも正しい）", () => {
    // JST 00:30 は UTC では前日 15:30
    expect(jstMinuteOfDay(jst(0, 30))).toBe(30);
    expect(isBlackout("00:00", "06:00", jst(0, 30))).toBe(true);
  });
});

describe("省エネ計算", () => {
  it("消費電力量は 電力(W) × 時間(h) / 1000 で kWh になる", () => {
    expect(calcKwhUsed(10, 60)).toBeCloseTo(0.01, 6);
    expect(calcKwhUsed(10, 0)).toBe(0);
  });

  it("節約量は 常時点灯想定（24時間）との差で、負にはならない", () => {
    expect(calcKwhSaved(10, 0)).toBeCloseTo(0.24, 6);
    expect(calcKwhSaved(10, 60)).toBeCloseTo(0.23, 6);
    expect(calcKwhSaved(10, 1440)).toBe(0);
    expect(calcKwhSaved(10, 2000)).toBe(0);
  });

  it("点灯中の時間は累計に現在までの経過を足す", () => {
    const onSince = Date.UTC(2026, 10, 4, 12, 0, 0);
    expect(currentOnMinutes(5, null, onSince + 60_000)).toBe(5);
    expect(currentOnMinutes(5, onSince, onSince + 120_000)).toBe(7);
  });
});
