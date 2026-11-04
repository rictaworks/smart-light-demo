import type { DashboardData, EnergyLog, Settings } from "@/types";

// 本番は同一オリジン（Workers Assets と /api/* の Worker が同じドメイン）なので既定は空文字。
// next dev で別ポートの wrangler dev を使うときだけ NEXT_PUBLIC_API_URL を設定する。
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status} ${path}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // セッション ID は Cookie（HttpOnly）で受け取るので、本文は使わない。
  createSession: () => request<{ ok: boolean }>("/api/session", { method: "POST" }),

  getLight: () => request<DashboardData>("/api/light"),

  updateSensor: (sensor_index: number, detected: boolean, lux: number) =>
    request<DashboardData>("/api/sensor", {
      method: "POST",
      body: JSON.stringify({ sensor_index, detected, lux }),
    }),

  setManual: (status: "on" | "off", brightness: number) =>
    request<{ light: DashboardData["light"] }>("/api/light/manual", {
      method: "POST",
      body: JSON.stringify({ status, brightness }),
    }),

  setAuto: () =>
    request<{ light: DashboardData["light"] }>("/api/light/auto", {
      method: "POST",
    }),

  getEnergy: () =>
    request<{ current: DashboardData["energy"]; logs: EnergyLog[] }>(
      "/api/energy"
    ),

  getSettings: () => request<Settings>("/api/settings"),

  updateSettings: (settings: Partial<Settings>) =>
    request<Settings>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),

  // 画面のリセット: このセッションのデータだけを消す（全体リセットは運用者専用で、画面からは呼ばない）。
  resetSession: () => request<{ ok: boolean }>("/api/session/reset", { method: "POST" }),
};
