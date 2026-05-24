import Link from "next/link";
import { VerdictBadge } from "./VerdictBadge";
import { BondHealthBar } from "./BondHealthBar";
import type { LeaderRow } from "@/lib/types";

export function LeaderCard({ leader }: { leader: LeaderRow }) {
  return (
    <Link href={`/leader/${leader.address}`} className="block no-underline">
      <div className="card hover:bg-bg-hover transition-colors">
        <div className="flex justify-between items-baseline mb-3">
          <div>
            <div className="text-md font-bold">{leader.handle || leader.address.slice(0, 8)}</div>
            <div className="text-xs text-fg-tertiary tabular">{leader.address.slice(0, 10)}…{leader.address.slice(-6)}</div>
          </div>
          <VerdictBadge verdict={leader.verdict} />
        </div>
        <div className="grid grid-cols-3 gap-4 mb-4 text-sm tabular">
          <Metric label="sharpe 30d" value={leader.hasMetrics ? leader.sharpe30d.toFixed(2) : "pending"} />
          <Metric label="drawdown"   value={leader.hasMetrics ? `${(leader.maxDrawdown * 100).toFixed(1)}%` : "pending"} />
          <Metric label="bond"       value={`${formatUSDC(leader.bondAmount)} USDC`} />
        </div>
        <BondHealthBar current={leader.bondAmount} original={leader.bondOriginal} />
      </div>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="mt-1">{value}</div>
    </div>
  );
}

function formatUSDC(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}
