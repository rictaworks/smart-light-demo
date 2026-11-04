// HTTP ルート（旧 backend/routers/*.py の移植）。レスポンスの形は旧 FastAPI と同じ。

import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { getCookie, setCookie } from "hono/cookie";
import type { Env } from "./env";
import { HttpError, validationError } from "./errors";
import { SessionRepository, type EnergyLogRow } from "./repository";
import { withSessionMachine } from "./service";
import { constantTimeEqual } from "./auth";
import type { LightState, SensorReadings, Settings } from "./domain/machine";
import {
  isJsonContentType,
  parseManualControl,
  parseSensorUpdate,
  parseSettingsUpdate
} from "./validation";

const SESSION_COOKIE_NAME = "session_id";
/** 旧実装どおり 1 日。 */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;
/** 開発時に next dev（既定ポート）から直接叩けるように許可する。 */
const LOCAL_DEV_ORIGIN = "http://localhost:3000";

type AppEnv = { Bindings: Env };

function lightJson(light: LightState) {
  return { status: light.status, brightness: light.brightness, mode: light.mode };
}

function sensorsJson(sensors: SensorReadings) {
  return sensors.map((sensor, index) => ({
    sensor_index: index,
    detected: sensor.detected,
    lux: sensor.lux
  }));
}

function energyJson(snapshot: { onMinutes: number; kwhUsed: number; kwhSaved: number }) {
  return {
    on_minutes: snapshot.onMinutes,
    kwh_used: snapshot.kwhUsed,
    kwh_saved: snapshot.kwhSaved
  };
}

function settingsJson(settings: Settings) {
  return {
    debounce_sec: settings.debounceSec,
    wait_sec: settings.waitSec,
    target_lux: settings.targetLux,
    power_watt: settings.powerWatt,
    blackout_from: settings.blackoutFrom,
    blackout_to: settings.blackoutTo
  };
}

function energyLogJson(row: EnergyLogRow) {
  return {
    on_minutes: row.on_minutes,
    kwh_used: row.kwh_used,
    kwh_saved: row.kwh_saved,
    logged_at: row.logged_at
  };
}

/** Cookie の session_id を必須とする（無ければ 401）。存在確認は withSessionMachine / load が行う。 */
function requireSessionId(c: Context<AppEnv>): string {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (!sessionId) {
    throw new HttpError(401, "セッションがありません");
  }
  return sessionId;
}

/**
 * リクエストボディを JSON として読む。
 * Content-Type が application/json でなければ 415（HTML フォームなど別経路からの送信を受けない）。
 * JSON として読めなければ 422。
 */
async function readJson(c: Context<AppEnv>): Promise<unknown> {
  if (!isJsonContentType(c.req.header("content-type"))) {
    throw new HttpError(415, "Content-Type は application/json で送ってください");
  }
  try {
    return await c.req.json();
  } catch {
    throw validationError("リクエストボディがJSONとして読めません");
  }
}

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use(
    "/api/*",
    cors({
      origin: (origin, c) =>
        origin === c.env.FRONTEND_URL || origin === LOCAL_DEV_ORIGIN ? origin : undefined,
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
      allowHeaders: ["Content-Type"]
    })
  );

  app.onError((err, c) => {
    if (err instanceof HttpError) {
      return c.json({ detail: err.message }, err.status);
    }
    console.error("未処理の例外", err);
    return c.json({ detail: "Internal Server Error" }, 500);
  });

  app.notFound((c) => c.json({ detail: "Not Found" }, 404));

  // セッション発行（旧 POST /api/session）。hp（ハニーポット）に値が入っていれば 400。
  // セッション ID は Cookie（HttpOnly）でだけ渡し、本文には返さない。
  app.post("/api/session", async (c) => {
    if ((c.req.query("hp") ?? "") !== "") {
      throw new HttpError(400, "Bad request");
    }
    const repo = new SessionRepository(c.env.DB);
    const existing = getCookie(c, SESSION_COOKIE_NAME);
    if (existing && (await repo.sessionExists(existing))) {
      await repo.touchSession(existing);
      return c.json({ ok: true });
    }

    const sessionId = crypto.randomUUID();
    await repo.createSession(sessionId);
    setCookie(c, SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS
    });
    return c.json({ ok: true });
  });

  // 画面のリセット: このセッションのデータだけを削除する（他のセッションには影響しない）。
  // 呼び出し側は続けて POST /api/session を呼び、新しいセッションを発行する。
  app.post("/api/session/reset", async (c) => {
    const sessionId = requireSessionId(c);
    await new SessionRepository(c.env.DB).purgeSession(sessionId);
    return c.json({ ok: true });
  });

  // センサー状態の更新（旧 POST /api/sensor）
  app.post("/api/sensor", async (c) => {
    const input = parseSensorUpdate(await readJson(c));
    const sessionId = requireSessionId(c);
    const nowMs = Date.now();
    const body = await withSessionMachine(new SessionRepository(c.env.DB), sessionId, nowMs, (machine) => {
      machine.sensorUpdate(nowMs, input.sensorIndex, input.detected, input.lux);
      return {
        light: lightJson(machine.light),
        sensors: sensorsJson(machine.runtime.sensors)
      };
    });
    return c.json(body);
  });

  // 照明・センサー・省エネの状態（旧 GET /api/light）。ポーリングで呼ばれるため期限の評価もここで行う。
  app.get("/api/light", async (c) => {
    const sessionId = requireSessionId(c);
    const nowMs = Date.now();
    const body = await withSessionMachine(new SessionRepository(c.env.DB), sessionId, nowMs, (machine) => ({
      light: lightJson(machine.light),
      sensors: sensorsJson(machine.runtime.sensors),
      energy: energyJson(machine.energySnapshot(nowMs))
    }));
    return c.json(body);
  });

  // 手動制御（旧 POST /api/light/manual）
  app.post("/api/light/manual", async (c) => {
    const input = parseManualControl(await readJson(c));
    const sessionId = requireSessionId(c);
    const nowMs = Date.now();
    const body = await withSessionMachine(new SessionRepository(c.env.DB), sessionId, nowMs, (machine) => {
      machine.setManual(nowMs, input.status, input.brightness);
      return { light: lightJson(machine.light) };
    });
    return c.json(body);
  });

  // 自動モード復帰（旧 POST /api/light/auto）
  app.post("/api/light/auto", async (c) => {
    const sessionId = requireSessionId(c);
    const nowMs = Date.now();
    const body = await withSessionMachine(new SessionRepository(c.env.DB), sessionId, nowMs, (machine) => {
      machine.setAuto(nowMs);
      return { light: lightJson(machine.light) };
    });
    return c.json(body);
  });

  // 省エネの現在値と過去24時間のログ（旧 GET /api/energy）
  app.get("/api/energy", async (c) => {
    const sessionId = requireSessionId(c);
    const nowMs = Date.now();
    const repo = new SessionRepository(c.env.DB);
    const current = await withSessionMachine(repo, sessionId, nowMs, (machine) =>
      energyJson(machine.energySnapshot(nowMs))
    );
    const logs = await repo.energyLogs24h(sessionId);
    return c.json({ current, logs: logs.map(energyLogJson) });
  });

  // 設定の取得（旧 GET /api/settings）
  app.get("/api/settings", async (c) => {
    const sessionId = requireSessionId(c);
    const loaded = await new SessionRepository(c.env.DB).load(sessionId);
    if (loaded === null) {
      throw new HttpError(404, "セッションが見つかりません");
    }
    return c.json(settingsJson(loaded.settings));
  });

  // 設定の更新（旧 PUT /api/settings）。値が無い項目は変更しない。
  app.put("/api/settings", async (c) => {
    const patch = parseSettingsUpdate(await readJson(c));
    const sessionId = requireSessionId(c);
    const nowMs = Date.now();
    const body = await withSessionMachine(new SessionRepository(c.env.DB), sessionId, nowMs, (machine) => {
      machine.updateSettings({ ...machine.settings, ...patch });
      return settingsJson(machine.settings);
    });
    return c.json(body);
  });

  // 全データの削除（運用者用）。Cookie では実行できない。
  // ヘッダー X-Admin-Token が ADMIN_RESET_TOKEN と一致したときだけ実行する。
  // ADMIN_RESET_TOKEN が未設定（または空）なら、このエンドポイントは無効（404）。
  app.post("/api/admin/reset", async (c) => {
    const expected = c.env.ADMIN_RESET_TOKEN;
    if (expected === undefined || expected === "") {
      throw new HttpError(404, "Not Found");
    }
    const provided = c.req.header("x-admin-token") ?? "";
    if (!constantTimeEqual(provided, expected)) {
      throw new HttpError(401, "管理用トークンが正しくありません");
    }
    await new SessionRepository(c.env.DB).purgeAll();
    return c.json({ status: "reset complete" });
  });

  return app;
}
