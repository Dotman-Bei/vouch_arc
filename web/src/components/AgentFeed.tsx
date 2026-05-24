"use client";

import { useEffect, useState } from "react";
import type { AgentRunSummary } from "@/lib/types";
import { fmtAge } from "@/lib/format";

export function AgentFeed({ pollMs = 15000 }: { pollMs?: number }) {
  const [runs, setRuns] = useState<AgentRunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch("/api/agent/runs", { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        if (!cancelled) {
          setRuns(d.runs ?? []);
          setLastUpdated(Date.now());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, pollMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [pollMs]);

  if (loading) return <div className="text-fg-secondary text-sm">streaming agent activity…</div>;
  if (runs.length === 0) return null;

  return (
    <div className="card p-0">
      <div className="flex justify-between items-center px-4 py-3 border-b border-line">
        <span className="label">live</span>
        <span className="text-xs text-fg-tertiary tabular">updated {fmtAge(lastUpdated)}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-t border-line first:border-t-0">
                <td className="whitespace-nowrap p-3 text-fg-secondary tabular">{fmtAge(r.startedAt)}</td>
                <td className="whitespace-nowrap p-3 text-right tabular">{r.leadersAnalyzed} leaders</td>
                <td className="whitespace-nowrap p-3 text-right tabular">avg {r.avgSharpe.toFixed(2)}</td>
                <td className={`whitespace-nowrap p-3 text-right tabular ${r.slashesTriggered > 0 ? "text-status-danger" : "text-fg-secondary"}`}>
                  {r.slashesTriggered > 0 ? `${r.slashesTriggered} slash` : "no slash"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
