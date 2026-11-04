// D1 へのアクセス（旧 backend/db/session_repository.py と database.py の移植）。
//
// 1回の状態更新は db.batch() の1トランザクションで行う。先頭の文が runtime_states.version を
// 期待値から新しい値へ書き換える（楽観ロック）。失敗したら後続の文も EXISTS 条件で何も書かないので、
// 呼び出し側は読み直して再計算すればよい。

import { NUM_SENSORS } from "./domain/machine";
import type {
  LightState,
  Mode,
  RuntimeState,
  SensorReading,
  SensorReadings,
  Settings,
  SessionMachine,
  Status
} from "./domain/machine";

export interface LoadedSession {
  version: number;
  settings: Settings;
  light: LightState;
  runtime: RuntimeState;
}

export interface EnergyLogRow {
  on_minutes: number;
  kwh_used: number;
  kwh_saved: number;
  logged_at: string;
}

interface SettingsRow {
  debounce_sec: number;
  wait_sec: number;
  target_lux: number;
  power_watt: number;
  blackout_from: string | null;
  blackout_to: string | null;
}

interface LightRow {
  status: string;
  brightness: number;
  mode: string;
}

interface RuntimeRow {
  sensors_json: string;
  confirmed_any: number;
  pending_any: number | null;
  pending_deadline_ms: number | null;
  wait_deadline_ms: number | null;
  on_since_ms: number | null;
  total_on_minutes: number;
  version: number;
}

const EXISTS_CURRENT_VERSION =
  "EXISTS (SELECT 1 FROM runtime_states WHERE session_id = ? AND version = ?)";

function toInt(value: boolean): number {
  return value ? 1 : 0;
}

// 保存データの破損を示す例外。エラー文に session_id 等の識別子は入れない（ログに残しても漏れないように）。
function corrupted(what: string): Error {
  return new Error(`保存データの ${what} が不正です`);
}

function toStatus(value: string): Status {
  if (value !== "on" && value !== "off") {
    throw corrupted("照明の状態");
  }
  return value;
}

function toMode(value: string): Mode {
  if (value !== "auto" && value !== "manual") {
    throw corrupted("制御モード");
  }
  return value;
}

function toSensorReading(value: unknown): SensorReading {
  if (typeof value !== "object" || value === null) {
    throw corrupted("センサー状態");
  }
  const { detected, lux } = value as { detected?: unknown; lux?: unknown };
  if (typeof detected !== "boolean" || typeof lux !== "number") {
    throw corrupted("センサー状態");
  }
  return { detected, lux };
}

function parseSensors(json: string): SensorReadings {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed) || parsed.length !== NUM_SENSORS) {
    throw corrupted("センサー状態");
  }
  return [toSensorReading(parsed[0]), toSensorReading(parsed[1]), toSensorReading(parsed[2])];
}

function serializeSensors(sensors: SensorReadings): string {
  return JSON.stringify(sensors.map((s) => ({ detected: s.detected, lux: s.lux })));
}

export class SessionRepository {
  constructor(private readonly db: D1Database) {}

  async sessionExists(sessionId: string): Promise<boolean> {
    const row = await this.db
      .prepare("SELECT id FROM sessions WHERE id = ?")
      .bind(sessionId)
      .first<{ id: string }>();
    return row !== null;
  }

  /** 新規セッションを作る。settings / light_states / runtime_states の既定値はスキーマの DEFAULT に任せる。 */
  async createSession(sessionId: string): Promise<void> {
    await this.db.batch([
      this.db.prepare("INSERT INTO sessions (id) VALUES (?)").bind(sessionId),
      this.db.prepare("INSERT INTO settings (session_id) VALUES (?)").bind(sessionId),
      this.db.prepare("INSERT INTO light_states (session_id) VALUES (?)").bind(sessionId),
      this.db.prepare("INSERT INTO runtime_states (session_id) VALUES (?)").bind(sessionId)
    ]);
  }

  async touchSession(sessionId: string): Promise<void> {
    await this.db
      .prepare("UPDATE sessions SET last_seen = datetime('now') WHERE id = ?")
      .bind(sessionId)
      .run();
  }

  /** セッションの状態を読む。セッションが無ければ null。行の欠損はデータ破損として例外にする。 */
  async load(sessionId: string): Promise<LoadedSession | null> {
    const results = await this.db.batch([
      this.db.prepare("SELECT id FROM sessions WHERE id = ?").bind(sessionId),
      this.db
        .prepare(
          "SELECT debounce_sec, wait_sec, target_lux, power_watt, blackout_from, blackout_to FROM settings WHERE session_id = ?"
        )
        .bind(sessionId),
      this.db
        .prepare("SELECT status, brightness, mode FROM light_states WHERE session_id = ?")
        .bind(sessionId),
      this.db
        .prepare(
          "SELECT sensors_json, confirmed_any, pending_any, pending_deadline_ms, wait_deadline_ms, on_since_ms, total_on_minutes, version FROM runtime_states WHERE session_id = ?"
        )
        .bind(sessionId)
    ]);

    const [sessionRes, settingsRes, lightRes, runtimeRes] = results;
    if (!sessionRes || !settingsRes || !lightRes || !runtimeRes) {
      throw new Error("保存データの読み込み結果が欠けています");
    }
    if ((sessionRes.results as unknown[]).length === 0) {
      return null;
    }
    const settingsRow = (settingsRes.results as SettingsRow[])[0];
    const lightRow = (lightRes.results as LightRow[])[0];
    const runtimeRow = (runtimeRes.results as RuntimeRow[])[0];
    if (!settingsRow || !lightRow || !runtimeRow) {
      throw new Error("保存データの状態行が欠けています");
    }

    let pending: RuntimeState["pending"] = null;
    if (runtimeRow.pending_any !== null) {
      if (runtimeRow.pending_deadline_ms === null) {
        throw corrupted("デバウンス期限");
      }
      pending = { any: runtimeRow.pending_any === 1, deadlineMs: runtimeRow.pending_deadline_ms };
    }

    return {
      version: runtimeRow.version,
      settings: {
        debounceSec: settingsRow.debounce_sec,
        waitSec: settingsRow.wait_sec,
        targetLux: settingsRow.target_lux,
        powerWatt: settingsRow.power_watt,
        blackoutFrom: settingsRow.blackout_from,
        blackoutTo: settingsRow.blackout_to
      },
      light: {
        status: toStatus(lightRow.status),
        brightness: lightRow.brightness,
        mode: toMode(lightRow.mode)
      },
      runtime: {
        sensors: parseSensors(runtimeRow.sensors_json),
        confirmedAny: runtimeRow.confirmed_any === 1,
        pending,
        waitDeadlineMs: runtimeRow.wait_deadline_ms,
        onSinceMs: runtimeRow.on_since_ms,
        totalOnMinutes: runtimeRow.total_on_minutes
      }
    };
  }

  /** 過去24時間の省エネログ（旧 get_energy_logs）。 */
  async energyLogs24h(sessionId: string): Promise<EnergyLogRow[]> {
    const result = await this.db
      .prepare(
        `SELECT on_minutes, kwh_used, kwh_saved, logged_at
         FROM energy_logs
         WHERE session_id = ? AND logged_at >= datetime('now', '-24 hours')
         ORDER BY logged_at ASC`
      )
      .bind(sessionId)
      .all<EnergyLogRow>();
    return result.results;
  }

  /**
   * 状態を保存する（楽観ロック付き）。expectedVersion と一致した場合だけ書き込み、true を返す。
   * 不一致（他のリクエストが先に更新した）なら何も書かず false を返す。呼び出し側は読み直して再計算する。
   */
  async commit(
    sessionId: string,
    expectedVersion: number,
    newVersion: number,
    machine: SessionMachine
  ): Promise<boolean> {
    const { runtime, light, settings } = machine;
    const statements: D1PreparedStatement[] = [
      this.db
        .prepare(
          `UPDATE runtime_states
           SET sensors_json = ?, confirmed_any = ?, pending_any = ?, pending_deadline_ms = ?,
               wait_deadline_ms = ?, on_since_ms = ?, total_on_minutes = ?,
               version = ?, updated_at = datetime('now')
           WHERE session_id = ? AND version = ?`
        )
        .bind(
          serializeSensors(runtime.sensors),
          toInt(runtime.confirmedAny),
          runtime.pending === null ? null : toInt(runtime.pending.any),
          runtime.pending === null ? null : runtime.pending.deadlineMs,
          runtime.waitDeadlineMs,
          runtime.onSinceMs,
          runtime.totalOnMinutes,
          newVersion,
          sessionId,
          expectedVersion
        ),
      this.db
        .prepare(
          `UPDATE light_states
           SET status = ?, brightness = ?, mode = ?, updated_at = datetime('now')
           WHERE session_id = ? AND ${EXISTS_CURRENT_VERSION}`
        )
        .bind(light.status, light.brightness, light.mode, sessionId, sessionId, newVersion)
    ];

    if (machine.settingsDirty) {
      statements.push(
        this.db
          .prepare(
            `UPDATE settings
             SET debounce_sec = ?, wait_sec = ?, target_lux = ?, power_watt = ?,
                 blackout_from = ?, blackout_to = ?, updated_at = datetime('now')
             WHERE session_id = ? AND ${EXISTS_CURRENT_VERSION}`
          )
          .bind(
            settings.debounceSec,
            settings.waitSec,
            settings.targetLux,
            settings.powerWatt,
            settings.blackoutFrom,
            settings.blackoutTo,
            sessionId,
            sessionId,
            newVersion
          )
      );
    }

    for (const log of machine.energyLogs) {
      statements.push(
        this.db
          .prepare(
            `INSERT INTO energy_logs (session_id, on_minutes, kwh_used, kwh_saved)
             SELECT ?, ?, ?, ? WHERE ${EXISTS_CURRENT_VERSION}`
          )
          .bind(sessionId, log.onMinutes, log.kwhUsed, log.kwhSaved, sessionId, newVersion)
      );
    }

    for (const log of machine.sensorLogs) {
      statements.push(
        this.db
          .prepare(
            `INSERT INTO sensor_logs (session_id, sensor_index, detected, lux)
             SELECT ?, ?, ?, ? WHERE ${EXISTS_CURRENT_VERSION}`
          )
          .bind(sessionId, log.sensorIndex, toInt(log.detected), log.lux, sessionId, newVersion)
      );
    }

    const results = await this.db.batch(statements);
    const versionUpdate = results[0];
    if (!versionUpdate) {
      throw new Error("状態の保存結果が返りませんでした");
    }
    return versionUpdate.meta.changes === 1;
  }

  /** 1セッション分のデータだけを削除する（画面のリセットボタン用）。他のセッションには影響しない。子テーブルから先に消す。 */
  async purgeSession(sessionId: string): Promise<void> {
    await this.db.batch([
      this.db.prepare("DELETE FROM energy_logs WHERE session_id = ?").bind(sessionId),
      this.db.prepare("DELETE FROM sensor_logs WHERE session_id = ?").bind(sessionId),
      this.db.prepare("DELETE FROM runtime_states WHERE session_id = ?").bind(sessionId),
      this.db.prepare("DELETE FROM light_states WHERE session_id = ?").bind(sessionId),
      this.db.prepare("DELETE FROM settings WHERE session_id = ?").bind(sessionId),
      this.db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId)
    ]);
  }

  /** 全テーブルを削除する（日次リセット・運用者による全体リセット）。子テーブルから先に消す。 */
  async purgeAll(): Promise<void> {
    const tables = [
      "energy_logs",
      "sensor_logs",
      "runtime_states",
      "light_states",
      "settings",
      "sessions"
    ];
    await this.db.batch(tables.map((table) => this.db.prepare(`DELETE FROM ${table}`)));
  }
}
