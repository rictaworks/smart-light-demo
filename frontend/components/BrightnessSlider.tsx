import type { LightState } from "@/types";

interface Props {
  light: LightState;
  onBrightnessChange: (brightness: number) => void;
}

export default function BrightnessSlider({ light, onBrightnessChange }: Props) {
  const isManual = light.mode === "manual";
  const isOn = light.status === "on";

  return (
    <div className="card">
      <div className="card-title">
        <i className="fas fa-sliders-h" />
        輝度調整
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <i className="fas fa-sun" style={{ color: "var(--text-muted)", fontSize: "0.875rem" }} />
        <div style={{ flex: 1, position: "relative" }}>
          <input
            type="range"
            min={0}
            max={100}
            value={light.brightness}
            onChange={(e) => onBrightnessChange(Number(e.target.value))}
            disabled={!isManual}
            style={{ width: "100%" }}
            aria-label="輝度スライダー"
          />
        </div>
        <i className="fas fa-sun" style={{ color: "var(--accent)", fontSize: "1.1rem" }} />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "0.8rem",
        }}
      >
        <span style={{ color: "var(--text-muted)" }}>
          {isManual ? "手動調整モード" : "自動制御中（スライダー無効）"}
        </span>
        <span
          style={{
            fontWeight: 700,
            fontSize: "1.1rem",
            color: isOn ? "var(--accent)" : "var(--text-muted)",
          }}
        >
          {light.brightness}%
        </span>
      </div>

      {/* 輝度バー */}
      <div
        style={{
          marginTop: 10,
          height: 6,
          borderRadius: 3,
          background: "var(--surface2)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${light.brightness}%`,
            background: isOn
              ? `linear-gradient(90deg, var(--accent), #fef08a)`
              : "var(--border)",
            transition: "width 0.3s ease",
            borderRadius: 3,
          }}
        />
      </div>
    </div>
  );
}
