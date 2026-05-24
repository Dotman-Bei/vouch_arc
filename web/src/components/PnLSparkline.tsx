"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from "recharts";

interface Point { t: string; sharpe: number; return7dBps: number; degradation: number }

export function PnLSparkline({ address }: { address: string }) {
  const [points, setPoints] = useState<Point[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/leaders/${address}/history`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setPoints(d.points ?? []); })
      .catch(() => { if (!cancelled) setPoints([]); });
    return () => { cancelled = true; };
  }, [address]);

  if (points === null) return <div className="text-sm text-fg-secondary">loading history…</div>;
  if (points.length < 2) {
    return (
      <p className="text-sm text-fg-tertiary">
        Not enough data yet. The agent appends a new point per cycle — check back after a few cycles.
      </p>
    );
  }

  const latest = points[points.length - 1];

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <span className="label">return 7d (bps) over time</span>
        <span className="text-sm tabular text-fg-secondary">
          latest {(latest.return7dBps / 100).toFixed(2)}%
        </span>
      </div>
      <div className="h-24 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Tooltip
              contentStyle={{
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border-strong)",
                fontFamily: "inherit",
                fontSize: 12,
              }}
              labelFormatter={(v: string) => new Date(v).toLocaleString()}
              formatter={(v: number) => [`${(v / 100).toFixed(2)}%`, "return 7d"]}
            />
            <Line
              type="monotone"
              dataKey="return7dBps"
              stroke="var(--accent-green)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
