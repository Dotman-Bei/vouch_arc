import { notFound } from "next/navigation";
import Link from "next/link";
import { ReasoningTrace } from "@/components/ReasoningTrace";
import { BondHealthBar } from "@/components/BondHealthBar";
import { FollowButton } from "@/components/FollowButton";
import { PnLSparkline } from "@/components/PnLSparkline";
import { getLeader } from "@/lib/leaders";
import { fmtUsdc, fmtAddr, fmtAge } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LeaderPage({ params }: { params: { address: string } }) {
  const leader = await getLeader(params.address);
  if (!leader) return notFound();

  return (
    <>
      <Link href="/leaderboard" className="text-sm text-fg-secondary mb-6 inline-block">← leaderboard</Link>
      <div className="counter mb-2">leader profile</div>
      <h1 className="text-xl font-bold mb-2">{leader.handle}</h1>
      <p className="text-sm text-fg-tertiary tabular mb-8">
        evm {fmtAddr(leader.address)} · hl {fmtAddr(leader.hlWallet)} · last update {leader.lastAnalyzed ? fmtAge(leader.lastAnalyzed) : "pending"}
      </p>

      <section className="card mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6 text-md tabular">
          <Stat label="bond"        value={`${fmtUsdc(leader.bondAmount, 0)} USDC`} />
          <Stat label="TVL"         value={`${fmtUsdc(leader.tvl, 0)} USDC`} />
          <Stat label="sharpe 30d"  value={leader.hasMetrics ? leader.sharpe30d.toFixed(2) : "pending"} />
          <Stat label="drawdown"    value={leader.hasMetrics ? `${(leader.maxDrawdown * 100).toFixed(1)}%` : "pending"} />
        </div>
        <BondHealthBar current={leader.bondAmount} original={leader.bondOriginal} />
      </section>

      <section className="mb-8">
        {leader.reasoningTrace ? (
          <ReasoningTrace
            trace={leader.reasoningTrace}
            reasonHash={leader.reasonHash}
            ipfsCid={leader.ipfsCid}
          />
        ) : (
          <div className="callout">
            <div className="label mb-2">AI reasoning trace</div>
            <p className="text-sm text-fg-secondary">
              No agent trace has been committed for this leader yet. The trace appears after the next successful agent cycle.
            </p>
          </div>
        )}
      </section>

      <section className="card mb-8">
        <PnLSparkline address={leader.address} />
      </section>

      <section className="card mb-8">
        <div className="label mb-3">AI metrics</div>
        {leader.hasMetrics ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5 tabular text-sm">
            <Metric label="sharpe 30d"     value={leader.sharpe30d.toFixed(2)} />
            <Metric label="win rate"       value={`${(leader.winRate * 100).toFixed(0)}%`} />
            <Metric label="return 7d"      value={`${(leader.return7dBps / 100).toFixed(2)}%`} />
            <Metric label="max drawdown"   value={`${(leader.maxDrawdown * 100).toFixed(1)}%`} />
            <Metric label="degradation"    value={`${leader.degradationScore}/100`} />
            <Metric label="confidence"     value={`${(leader.confidence * 100).toFixed(0)}%`} />
          </div>
        ) : (
          <p className="text-sm text-fg-secondary">
            No metric evidence has been committed yet. This leader is shown as pending until the agent completes a successful analysis cycle.
          </p>
        )}
      </section>

      {leader.hasMetrics ? (
        <FollowButton leader={leader.address} handle={leader.handle} />
      ) : (
        <div className="callout">
          <div className="label mb-2">follow unavailable</div>
          <p className="text-sm text-fg-secondary">
            Following opens after the agent commits the first metric row for this leader.
          </p>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label mb-1">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
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
