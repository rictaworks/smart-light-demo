import { useEffect, useRef } from "react";
import type { EnergyLog, EnergySnapshot } from "@/types";
import {
  Chart,
  LineElement,
  PointElement,
  LineController,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

Chart.register(
  LineElement,
  PointElement,
  LineController,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler
);

interface Props {
  current: EnergySnapshot;
  logs: EnergyLog[];
}

export default function EnergyChart({ current, logs }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const labels = logs.map((l) => {
      const d = new Date(l.logged_at);
      return `${d.getHours().toString().padStart(2, "0")}:${d
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;
    });
    const kwhData = logs.map((l) => l.kwh_used);

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    chartRef.current = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "消費電力量 (kWh)",
            data: kwhData,
            borderColor: "#f59e0b",
            backgroundColor: "rgba(245,158,11,0.1)",
            fill: true,
            tension: 0.4,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: "#e2e8f0" } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${(ctx.parsed.y ?? 0).toFixed(4)} kWh`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: "#94a3b8", maxTicksLimit: 8 },
            grid: { color: "#334155" },
          },
          y: {
            ticks: { color: "#94a3b8" },
            grid: { color: "#334155" },
            beginAtZero: true,
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [logs]);

  return (
    <div className="card">
      <div className="card-title">
        <i className="fas fa-chart-line" />
        省エネ状況（過去24時間）
      </div>

      {/* サマリー */}
      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <StatBox
          icon="fa-clock"
          label="点灯時間"
          value={`${current.on_minutes.toFixed(1)} 分`}
          color="var(--blue)"
        />
        <StatBox
          icon="fa-bolt"
          label="消費電力量"
          value={`${(current.kwh_used * 1000).toFixed(2)} Wh`}
          color="var(--accent)"
        />
        <StatBox
          icon="fa-leaf"
          label="節約電力量"
          value={`${(current.kwh_saved * 1000).toFixed(2)} Wh`}
          color="var(--green)"
        />
      </div>

      {logs.length > 0 ? (
        <canvas ref={canvasRef} height={180} aria-label="省エネグラフ" />
      ) : (
        <div
          style={{
            height: 180,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
            fontSize: "0.875rem",
          }}
        >
          <i className="fas fa-info-circle" style={{ marginRight: 8 }} />
          ログデータなし（照明が消灯するとグラフが表示されます）
        </div>
      )}
    </div>
  );
}

function StatBox({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "var(--surface2)",
        borderRadius: 8,
        padding: "10px 12px",
        textAlign: "center",
      }}
    >
      <i className={`fas ${icon}`} style={{ color, fontSize: "1.1rem", marginBottom: 4, display: "block" }} />
      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{value}</div>
    </div>
  );
}
