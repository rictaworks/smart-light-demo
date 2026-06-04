import { useEffect, useRef, useState } from "react";
import type { DashboardData, EnergyLog, Settings } from "@/types";
import { api } from "@/lib/api";
import SensorPanel from "@/components/SensorPanel";
import LightControl from "@/components/LightControl";
import BrightnessSlider from "@/components/BrightnessSlider";
import EnergyChart from "@/components/EnergyChart";
import ScheduleSettings from "@/components/ScheduleSettings";

const DEFAULT_DASHBOARD: DashboardData = {
  light: { status: "off", brightness: 70, mode: "auto" },
  sensors: [
    { sensor_index: 0, detected: false, lux: 0 },
    { sensor_index: 1, detected: false, lux: 0 },
    { sensor_index: 2, detected: false, lux: 0 },
  ],
  energy: { on_minutes: 0, kwh_used: 0, kwh_saved: 0 },
};

const DEFAULT_SETTINGS: Settings = {
  debounce_sec: 2,
  wait_sec: 60,
  target_lux: 300,
  power_watt: 10,
  blackout_from: null,
  blackout_to: null,
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData>(DEFAULT_DASHBOARD);
  const [energyLogs, setEnergyLogs] = useState<EnergyLog[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 初期化
  useEffect(() => {
    async function init() {
      try {
        await api.createSession();
        const [dash, energy, cfg] = await Promise.all([
          api.getLight(),
          api.getEnergy(),
          api.getSettings(),
        ]);
        setData(dash);
        setEnergyLogs(energy.logs);
        setSettings(cfg);
        setReady(true);
      } catch (e) {
        setError(String(e));
      }
    }
    init();
  }, []);

  // ポーリング（1秒ごとに照明状態を取得）
  useEffect(() => {
    if (!ready) return;
    pollRef.current = setInterval(async () => {
      try {
        const dash = await api.getLight();
        setData(dash);
      } catch (e) {
        setError(String(e));
      }
    }, 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [ready]);

  // エネルギーログ（30秒ごとに取得）
  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(async () => {
      try {
        const energy = await api.getEnergy();
        setEnergyLogs(energy.logs);
        setData((prev) => ({
          ...prev,
          energy: energy.current,
        }));
      } catch (e) {
        setError(String(e));
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [ready]);

  async function handleSensorToggle(index: number, detected: boolean, lux: number) {
    try {
      const res = await api.updateSensor(index, detected, lux);
      setData((prev) => ({ ...prev, light: res.light, sensors: res.sensors }));
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleLuxChange(index: number, lux: number) {
    const sensor = data.sensors[index];
    if (!sensor) return;
    try {
      const res = await api.updateSensor(index, sensor.detected, lux);
      setData((prev) => ({ ...prev, light: res.light, sensors: res.sensors }));
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleManual(status: "on" | "off", brightness: number) {
    try {
      const res = await api.setManual(status, brightness);
      setData((prev) => ({ ...prev, light: res.light }));
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleAuto() {
    try {
      const res = await api.setAuto();
      setData((prev) => ({ ...prev, light: res.light }));
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleBrightness(brightness: number) {
    if (data.light.mode !== "manual") return;
    try {
      const res = await api.setManual(data.light.status, brightness);
      setData((prev) => ({ ...prev, light: res.light }));
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleSettingsUpdate(s: Partial<Settings>) {
    try {
      const updated = await api.updateSettings(s);
      setSettings(updated);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleReset() {
    try {
      await api.resetDb();
      setData(DEFAULT_DASHBOARD);
      setEnergyLogs([]);
      setSettings(DEFAULT_SETTINGS);
    } catch (e) {
      setError(String(e));
    }
  }

  if (error) {
    return (
      <div className="container" style={{ paddingTop: 80, textAlign: "center" }}>
        <i className="fas fa-exclamation-triangle" style={{ fontSize: "2rem", color: "var(--red)", marginBottom: 16 }} />
        <p style={{ color: "var(--red)", marginBottom: 12 }}>{error}</p>
        <button className="btn btn-secondary" onClick={() => setError(null)}>
          <i className="fas fa-redo" />
          再試行
        </button>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="container" style={{ paddingTop: 80, textAlign: "center", color: "var(--text-muted)" }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize: "2rem", marginBottom: 12, display: "block" }} />
        接続中...
      </div>
    );
  }

  return (
    <div className="container">
      {/* ヘッダー */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
          paddingBottom: 16,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <i className="fas fa-lightbulb" style={{ color: "var(--accent)" }} />
            Smart Light Demo
          </h1>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 2 }}>
            IoT 照明シミュレーター
          </p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={handleReset}
          aria-label="DBリセット"
          style={{ fontSize: "0.75rem" }}
        >
          <i className="fas fa-trash-restore" />
          リセット
        </button>
      </header>

      {/* メインレイアウト */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 320px", alignItems: "start", gap: 16 }}>
        {/* 左カラム */}
        <div className="grid" style={{ gap: 16 }}>
          <SensorPanel
            sensors={data.sensors}
            onToggle={handleSensorToggle}
            onLux={handleLuxChange}
          />
          <EnergyChart current={data.energy} logs={energyLogs} />
        </div>

        {/* 右カラム */}
        <div className="grid" style={{ gap: 16 }}>
          <LightControl
            light={data.light}
            onManual={handleManual}
            onAuto={handleAuto}
          />
          <BrightnessSlider
            light={data.light}
            onBrightnessChange={handleBrightness}
          />
          <ScheduleSettings settings={settings} onUpdate={handleSettingsUpdate} />
        </div>
      </div>

      {/* フッター */}
      <footer
        style={{
          marginTop: 32,
          paddingTop: 16,
          borderTop: "1px solid var(--border)",
          fontSize: "0.75rem",
          color: "var(--text-muted)",
          textAlign: "center",
        }}
      >
        Smart Light Demo v0.1 &nbsp;|&nbsp; DB は毎日 JST 03:00 に自動リセットされます
      </footer>
    </div>
  );
}
