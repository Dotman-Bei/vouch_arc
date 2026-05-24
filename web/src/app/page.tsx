import Link from "next/link";
import { LeaderCard } from "@/components/LeaderCard";
import { EmptyState } from "@/components/EmptyState";
import { getLeaders, getAgentRuns, getSlashEvents } from "@/lib/leaders";
import { fmtUsdc, fmtAge } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const HOME_PREVIEW_LIMIT = 1;

export default async function Home() {
  const [leaders, runs, slashes] = await Promise.all([
    getLeaders(),
    getAgentRuns(HOME_PREVIEW_LIMIT),
    getSlashEvents(1),
  ]);

  const analyzed = leaders.filter((l) => l.hasMetrics);
  const latestRanked = [...analyzed]
    .sort((a, b) => {
      const at = a.lastAnalyzed ? new Date(a.lastAnalyzed).getTime() : 0;
      const bt = b.lastAnalyzed ? new Date(b.lastAnalyzed).getTime() : 0;
      return bt - at;
    })
    .slice(0, HOME_PREVIEW_LIMIT);
  const totalBonded    = leaders.reduce((a, l) => a + l.bondAmount, 0);
  const totalTvl       = leaders.reduce((a, l) => a + l.tvl, 0);
  const avgSharpe      = analyzed.length === 0 ? 0 : analyzed.reduce((a, l) => a + l.sharpe30d, 0) / analyzed.length;
  const lastSlash      = slashes[0]?.timestamp ? fmtAge(slashes[0].timestamp) : "—";

  return (
    <>
      <section className="mb-16">
        <div className="counter mb-2">00 — vouch</div>
        <h1 className="text-xl md:text-2xl font-bold leading-tight mb-6">
          Copy trading where the leader bleeds first.
        </h1>
        <p className="text-base text-fg-primary max-w-prose mb-8">
          Every leader on Vouch posts a USDC bond before attracting followers.
          An autonomous AI agent scores newly bonded leaders within minutes,
          publishes IPFS-pinned reasoning traces, and slashes the bond — not your deposit — the moment
          performance degrades. Your principal is the last thing to be touched.
        </p>
        <div className="flex gap-3 flex-wrap">
          <Link href="/leaderboard" className="btn-primary no-underline">explore leaders</Link>
          <Link href="/app/leader"   className="btn-ghost   no-underline">post a bond</Link>
        </div>
      </section>

      <section className="mb-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="total bonded"      value={`${fmtUsdc(totalBonded, 0)} USDC`} />
          <Stat label="follower TVL"      value={`${fmtUsdc(totalTvl, 0)} USDC`} />
          <Stat label="avg leader sharpe" value={analyzed.length === 0 ? "pending" : avgSharpe.toFixed(2)} />
          <Stat label="last slash"        value={lastSlash} tone={slashes.length > 0 ? "danger" : undefined} />
        </div>
      </section>

      <section className="mb-16">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-lg font-bold">
            <span className="counter mr-3">01</span>
            AI-ranked leaders
          </h2>
          <Link href="/leaderboard" className="text-sm">view all →</Link>
        </div>
        {latestRanked.length === 0 ? (
          <EmptyState
            title={leaders.length === 0 ? "No leaders bonded yet." : "Awaiting agent evidence."}
            body={leaders.length === 0
              ? "The first leader to post a USDC bond will appear here within one agent cycle. Bonds are the foundation of Vouch - they're what makes the leader bleed first."
              : "Bonded leaders appear in this ranking after the agent commits their first metric row and reasoning trace."}
            cta={leaders.length === 0 ? <Link href="/app/leader" className="btn-primary no-underline">post the first bond</Link> : undefined}
          />
        ) : (
          <div className="grid gap-4">
            {latestRanked.map((l) => <LeaderCard key={l.address} leader={l} />)}
          </div>
        )}
      </section>

      <section className="mb-16">
        <h2 className="text-lg font-bold mb-6">
          <span className="counter mr-3">02</span>
          How it works
        </h2>
        <ul className="em-list text-base space-y-2">
          <li>Leaders post a USDC bond to <code>BondRegistry</code> on Arc.</li>
          <li>Followers deposit USDC to <code>FollowerVault</code> for synthetic exposure to the leader's PnL.</li>
          <li>The agent scores new leaders within minutes, then re-audits scored leaders on the monitoring interval.</li>
          <li>When the agent detects strategy degradation, it triggers a graduated bond slash. Slashed USDC tops up the follower index.</li>
          <li>Followers cannot lose principal until the leader's bond is exhausted. The leader bleeds first.</li>
        </ul>
      </section>

      <section className="mb-16">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-lg font-bold">
            <span className="counter mr-3">03</span>
            Agent activity
          </h2>
          <Link href="/agent" className="text-sm">full log →</Link>
        </div>
        {runs.length === 0 ? (
          <EmptyState
            title="No agent runs yet."
            body="The agent will execute its first cycle once at least one leader is bonded. Every cycle pulls Hyperliquid data, computes risk-adjusted metrics, and posts on-chain verdicts."
          />
        ) : (
          <div className="card divide-y divide-line">
            {runs.map((r) => (
              <div key={r.id} className="flex justify-between items-center py-3 first:pt-0 last:pb-0 text-sm">
                <span className="text-fg-secondary tabular">{fmtAge(r.startedAt)}</span>
                <span className="tabular">{r.leadersAnalyzed} leaders</span>
                <span className="tabular">avg sharpe {r.avgSharpe.toFixed(2)}</span>
                <span className={r.slashesTriggered > 0 ? "text-status-danger" : "text-fg-secondary"}>
                  {r.slashesTriggered > 0 ? `${r.slashesTriggered} slash` : "no slash"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className="card">
      <div className="label mb-2">{label}</div>
      <div className={`text-md font-bold tabular ${tone === "danger" ? "text-status-danger" : ""}`}>
        {value}
      </div>
    </div>
  );
}
