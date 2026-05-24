"use client";

export function BondHealthBar({
  current,
  original,
}: { current: number; original: number }) {
  const pct = original === 0 ? 0 : Math.max(0, Math.min(100, (current / original) * 100));
  const color =
    pct > 66 ? "var(--status-good)" :
    pct > 33 ? "var(--accent-amber)" :
               "var(--status-danger)";
  return (
    <div>
      <div className="flex justify-between text-xs text-fg-secondary mb-2">
        <span className="label">bond health</span>
        <span className="tabular">{pct.toFixed(1)}% remaining</span>
      </div>
      <div className="h-2 w-full" style={{ background: "var(--border-default)" }}>
        <div
          className="h-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
