import Link from "next/link";
import { VerdictBadge } from "@/components/VerdictBadge";
import { EmptyState } from "@/components/EmptyState";
import { getLeaders } from "@/lib/leaders";
import { fmtUsdc } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LeaderboardPage() {
  const leaders = await getLeaders();
  const ranked = [...leaders].sort((a, b) => {
    if (a.hasMetrics !== b.hasMetrics) return a.hasMetrics ? -1 : 1;
    return a.degradationScore - b.degradationScore;
  });

  return (
    <>
      <div className="counter mb-2">01</div>
      <h1 className="text-xl font-bold mb-3">Leaderboard</h1>
      <p className="text-fg-secondary mb-10 max-w-prose">
        Ranked by composite degradation score (lower = better). New leaders are
        scored within minutes, then re-audited on the monitoring interval. All
        metrics are computed from public Hyperliquid trade history. Reasoning
        traces are IPFS-pinned and hash-committed on-chain.
      </p>

      {ranked.length === 0 ? (
        <EmptyState
          title="No leaders bonded yet."
          body="The first leader to post a USDC bond will appear here within one agent cycle."
          cta={<Link href="/app/leader" className="btn-primary no-underline">post the first bond</Link>}
        />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full whitespace-nowrap text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.10em] text-fg-secondary">
                <th className="p-4">#</th>
                <th className="p-4">leader</th>
                <th className="p-4 text-right">bond</th>
                <th className="p-4 text-right">TVL</th>
                <th className="p-4 text-right">sharpe 30d</th>
                <th className="p-4 text-right">drawdown</th>
                <th className="p-4">verdict</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((l, i) => (
                <tr key={l.address} className="border-t border-line hover:bg-bg-hover">
                  <td className="p-4 text-fg-tertiary tabular">{String(i + 1).padStart(2, "0")}</td>
                  <td className="p-4">
                    <Link href={`/leader/${l.address}`}>
                      {l.handle || `${l.address.slice(0, 8)}…`}
                    </Link>
                  </td>
                  <td className="p-4 text-right tabular">{fmtUsdc(l.bondAmount, 0)} USDC</td>
                  <td className="p-4 text-right tabular">{fmtUsdc(l.tvl, 0)} USDC</td>
                  <td className="p-4 text-right tabular">{l.hasMetrics ? l.sharpe30d.toFixed(2) : "pending"}</td>
                  <td className="p-4 text-right tabular">{l.hasMetrics ? `${(l.maxDrawdown * 100).toFixed(1)}%` : "pending"}</td>
                  <td className="p-4"><VerdictBadge verdict={l.verdict} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
