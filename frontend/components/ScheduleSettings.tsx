import { useState, useEffect } from "react";
import type { Settings } from "@/types";

interface Props {
  settings: Settings;
  onUpdate: (s: Partial<Settings>) => void;
}

export default function ScheduleSettings({ settings, onUpdate }: Props) {
  const [local, setLocal] = useState<Settings>(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLocal(settings);
  }, [settings]);

  function handleSave() {
    onUpdate({
      debounce_sec: local.debounce_sec,
      wait_sec: local.wait_sec,
      target_lux: local.target_lux,
      power_watt: local.power_watt,
      blackout_from: local.blackout_from || undefined,
      blackout_to: local.blackout_to || undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function field<K extends keyof Settings>(
    key: K,
    val: Settings[K]
  ) {
    setLocal((prev) => ({ ...prev, [key]: val }));
  }

  return (
    <div className="card">
      <div className="card-title">
        <i className="fas fa-cog" />
        設定
      </div>

      <div className="grid grid-2" style={{ gap: 12, marginBottom: 16 }}>
        <div>
          <label>デバウンス時間（秒）</label>
          <input
            type="number"
            min={1}
            max={10}
            value={local.debounce_sec}
            onChange={(e) => field("debounce_sec", Number(e.target.value))}
            aria-label="デバウンス秒"
          />
        </div>

        <div>
          <label>待機時間（秒）</label>
          <input
            type="number"
            min={0}
            max={3600}
            value={local.wait_sec}
            onChange={(e) => field("wait_sec", Number(e.target.value))}
            aria-label="待機秒"
          />
        </div>

        <div>
          <label>目標照度（lux）</label>
          <input
            type="number"
            min={0}
            max={1000}
            value={local.target_lux}
            onChange={(e) => field("target_lux", Number(e.target.value))}
            aria-label="目標照度"
          />
        </div>

        <div>
          <label>消費電力（W）</label>
          <input
            type="number"
            min={0.1}
            max={10000}
            step={0.1}
            value={local.power_watt}
            onChange={(e) => field("power_watt", Number(e.target.value))}
            aria-label="消費電力W"
          />
        </div>
      </div>

      {/* 消灯スケジュール */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          paddingTop: 12,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: "0.8rem",
            fontWeight: 600,
            color: "var(--text-muted)",
            marginBottom: 8,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <i className="fas fa-moon" />
          消灯スケジュール（空白で無効）
        </div>
        <div className="grid grid-2" style={{ gap: 12 }}>
          <div>
            <label>開始時刻</label>
            <input
              type="time"
              value={local.blackout_from ?? ""}
              onChange={(e) =>
                field("blackout_from", e.target.value || null)
              }
              aria-label="消灯開始"
            />
          </div>
          <div>
            <label>終了時刻</label>
            <input
              type="time"
              value={local.blackout_to ?? ""}
              onChange={(e) =>
                field("blackout_to", e.target.value || null)
              }
              aria-label="消灯終了"
            />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="btn btn-primary" onClick={handleSave} aria-label="設定を保存">
          <i className="fas fa-save" />
          保存
        </button>
        {saved && (
          <span style={{ color: "var(--green)", fontSize: "0.875rem" }}>
            <i className="fas fa-check" style={{ marginRight: 4 }} />
            保存しました
          </span>
        )}
      </div>
    </div>
  );
}
