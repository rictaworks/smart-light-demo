import type { DashboardData, EnergyLog, Settings } from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
  createSession: () =>
    request<{ session_id: string }>("/api/session", { method: "POST" }),

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

  resetDb: () =>
    request<{ status: string }>("/api/admin/reset", { method: "POST" }),
};
