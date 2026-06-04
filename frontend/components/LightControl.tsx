import type { LightState } from "@/types";

interface Props {
  light: LightState;
  onManual: (status: "on" | "off", brightness: number) => void;
  onAuto: () => void;
}

export default function LightControl({ light, onManual, onAuto }: Props) {
  const isOn = light.status === "on";
  const isManual = light.mode === "manual";

  return (
    <div className="card" style={{ textAlign: "center" }}>
      <div className="card-title" style={{ justifyContent: "center" }}>
        <i className="fas fa-lightbulb" />
        照明状態
      </div>

      {/* 電球ビジュアル */}
      <div
        style={{
          margin: "12px auto 20px",
          width: 100,
          height: 100,
          borderRadius: "50%",
          background: isOn
            ? `radial-gradient(circle, #fef08a, var(--accent))`
            : "var(--surface2)",
          boxShadow: isOn
            ? `0 0 40px 12px var(--accent-glow), 0 0 80px 24px rgba(245,158,11,0.15)`
            : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "2.5rem",
          transition: "all 0.4s ease",
          border: `2px solid ${isOn ? "var(--accent)" : "var(--border)"}`,
        }}
        aria-label={`照明${isOn ? "ON" : "OFF"}`}
      >
        <i
          className="fas fa-lightbulb"
          style={{ color: isOn ? "#92400e" : "var(--text-muted)" }}
        />
      </div>

      <div style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 4 }}>
        {isOn ? "点灯中" : "消灯中"}
      </div>
      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 16 }}>
        輝度: {light.brightness}% &nbsp;|&nbsp;
        モード:{" "}
        <span
          style={{
            color: isManual ? "var(--accent)" : "var(--blue)",
            fontWeight: 600,
          }}
        >
          {isManual ? "手動" : "自動"}
        </span>
      </div>

      {/* モード切替 */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        {isManual ? (
          <>
            <button
              className="btn btn-success"
              onClick={() => onManual("on", light.brightness || 70)}
              disabled={isOn}
              aria-label="手動ON"
            >
              <i className="fas fa-power-off" />
              手動 ON
            </button>
            <button
              className="btn btn-danger"
              onClick={() => onManual("off", 0)}
              disabled={!isOn}
              aria-label="手動OFF"
            >
              <i className="fas fa-power-off" />
              手動 OFF
            </button>
            <button className="btn btn-secondary" onClick={onAuto} aria-label="自動モードに戻す">
              <i className="fas fa-robot" />
              自動に戻す
            </button>
          </>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => onManual(isOn ? "off" : "on", light.brightness || 70)}
            aria-label="手動モードに切り替え"
          >
            <i className="fas fa-hand-pointer" />
            手動モードに切り替え
          </button>
        )}
      </div>
    </div>
  );
}
