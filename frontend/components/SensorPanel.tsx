import type { SensorState } from "@/types";

interface Props {
  sensors: SensorState[];
  onToggle: (index: number, detected: boolean, lux: number) => void;
  onLux: (index: number, lux: number) => void;
}

const SENSOR_LABELS = ["センサー A", "センサー B", "センサー C"];

export default function SensorPanel({ sensors, onToggle, onLux }: Props) {
  return (
    <div className="card">
      <div className="card-title">
        <i className="fas fa-satellite-dish" />
        人感センサー
      </div>
      <div className="grid grid-3">
        {sensors.map((s) => (
          <div
            key={s.sensor_index}
            style={{
              background: s.detected ? "rgba(34,197,94,0.1)" : "var(--surface2)",
              border: `1px solid ${s.detected ? "var(--green)" : "var(--border)"}`,
              borderRadius: 8,
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                {SENSOR_LABELS[s.sensor_index]}
              </span>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: s.detected ? "var(--green)" : "var(--text-muted)",
                  fontWeight: 600,
                }}
              >
                {s.detected ? "検知中" : "未検知"}
              </span>
            </div>

            <button
              className={`btn ${s.detected ? "btn-danger" : "btn-success"}`}
              style={{ justifyContent: "center", width: "100%" }}
              onClick={() => onToggle(s.sensor_index, !s.detected, s.lux)}
              aria-label={`センサー${s.sensor_index}トグル`}
            >
              <i className={`fas fa-${s.detected ? "toggle-on" : "toggle-off"}`} />
              {s.detected ? "OFF にする" : "ON にする"}
            </button>

            <div>
              <label>
                <i className="fas fa-sun" style={{ marginRight: 4 }} />
                照度: {s.lux} lux
              </label>
              <input
                type="range"
                min={0}
                max={1000}
                value={s.lux}
                onChange={(e) => onLux(s.sensor_index, Number(e.target.value))}
                aria-label={`センサー${s.sensor_index}照度`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
