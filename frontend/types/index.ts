export interface LightState {
  status: "on" | "off";
  brightness: number;
  mode: "auto" | "manual";
}

export interface SensorState {
  sensor_index: number;
  detected: boolean;
  lux: number;
}

export interface EnergySnapshot {
  on_minutes: number;
  kwh_used: number;
  kwh_saved: number;
}

export interface EnergyLog {
  on_minutes: number;
  kwh_used: number;
  kwh_saved: number;
  logged_at: string;
}

export interface Settings {
  debounce_sec: number;
  wait_sec: number;
  target_lux: number;
  power_watt: number;
  blackout_from: string | null;
  blackout_to: string | null;
}

export interface DashboardData {
  light: LightState;
  sensors: SensorState[];
  energy: EnergySnapshot;
}
