// リクエストボディの検証（旧 pydantic モデルの制約を移植）。違反は 422 を返す（FastAPI と同じステータス）。

import { validationError } from "./errors";
import type { SensorIndex, Settings, Status } from "./domain/machine";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Content-Type が application/json か（";charset=utf-8" などのパラメータは無視して判定）。
 * JSON 以外の本文を受けないことで、HTML フォーム等による別オリジンからの送信を弾く。
 */
export function isJsonContentType(header: string | undefined): boolean {
  if (header === undefined) {
    return false;
  }
  const mediaType = header.split(";")[0]?.trim().toLowerCase();
  return mediaType === "application/json";
}

function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw validationError("リクエストボディはJSONオブジェクトで指定してください");
  }
  return body as Record<string, unknown>;
}

function requireInteger(obj: Record<string, unknown>, key: string, min: number, max: number): number {
  const value = obj[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw validationError(`${key} は ${min} 以上 ${max} 以下の整数で指定してください`);
  }
  return value;
}

function optionalInteger(
  obj: Record<string, unknown>,
  key: string,
  min: number,
  max: number
): number | undefined {
  if (obj[key] === undefined || obj[key] === null) {
    return undefined;
  }
  return requireInteger(obj, key, min, max);
}

function requireBoolean(obj: Record<string, unknown>, key: string): boolean {
  const value = obj[key];
  if (typeof value !== "boolean") {
    throw validationError(`${key} は true か false で指定してください`);
  }
  return value;
}

export interface SensorUpdateInput {
  sensorIndex: SensorIndex;
  detected: boolean;
  lux: number;
}

export function parseSensorUpdate(body: unknown): SensorUpdateInput {
  const obj = asObject(body);
  return {
    sensorIndex: requireInteger(obj, "sensor_index", 0, 2) as SensorIndex,
    detected: requireBoolean(obj, "detected"),
    lux: requireInteger(obj, "lux", 0, 1000)
  };
}

export interface ManualControlInput {
  status: Status;
  brightness: number;
}

export function parseManualControl(body: unknown): ManualControlInput {
  const obj = asObject(body);
  const status = obj.status;
  if (status !== "on" && status !== "off") {
    throw validationError("status は on か off で指定してください");
  }
  return { status, brightness: requireInteger(obj, "brightness", 0, 100) };
}

/** 設定の部分更新。値が無い（未指定・null）項目は含めない（旧 exclude_none と同じ）。 */
export type SettingsPatch = Partial<Settings>;

function optionalTime(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string" || !TIME_PATTERN.test(value)) {
    throw validationError(`${key} は HH:MM 形式で指定してください`);
  }
  return value;
}

export function parseSettingsUpdate(body: unknown): SettingsPatch {
  const obj = asObject(body);
  const patch: SettingsPatch = {};

  const debounceSec = optionalInteger(obj, "debounce_sec", 1, 10);
  if (debounceSec !== undefined) patch.debounceSec = debounceSec;

  const waitSec = optionalInteger(obj, "wait_sec", 0, 3600);
  if (waitSec !== undefined) patch.waitSec = waitSec;

  const targetLux = optionalInteger(obj, "target_lux", 0, 1000);
  if (targetLux !== undefined) patch.targetLux = targetLux;

  const powerValue = obj.power_watt;
  if (powerValue !== undefined && powerValue !== null) {
    if (typeof powerValue !== "number" || !Number.isFinite(powerValue) || powerValue <= 0 || powerValue > 10000) {
      throw validationError("power_watt は 0 より大きく 10000 以下の数値で指定してください");
    }
    patch.powerWatt = powerValue;
  }

  const blackoutFrom = optionalTime(obj, "blackout_from");
  if (blackoutFrom !== undefined) patch.blackoutFrom = blackoutFrom;

  const blackoutTo = optionalTime(obj, "blackout_to");
  if (blackoutTo !== undefined) patch.blackoutTo = blackoutTo;

  return patch;
}
