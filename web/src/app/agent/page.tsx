import { EmptyState } from "@/components/EmptyState";
import { AgentFeed } from "@/components/AgentFeed";
import { getLeaders, getAgentRuns, getSlashEvents } from "@/lib/leaders";
import { fmtUsdc, fmtAddr } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AgentPage() {
  const [leaders, runs, slashes] = await Promise.all([
    getLeaders(),
    getAgentRuns(20),
    getSlashEvents(20),
  ]);
  const scoredLeaders = leaders.filter((l) => l.hasMetrics);

  return (
    <>
      <div className="counter mb-2">03</div>
      <h1 className="text-xl font-bold mb-3">Agent activity</h1>
      <p className="text-fg-secondary mb-10 max-w-prose">
        Every few minutes the Vouch agent checks for newly bonded leaders,
        fetches their Hyperliquid history, and publishes the first score.
        Already-scored leaders are re-audited on the monitoring interval. All
        decisions below are signed on-chain transactions backed by real USDC at risk.
      </p>

      <section className="mb-12">
        <h2 className="text-md font-bold mb-4">
          <span className="label mr-2">latest</span> degradation scores
        </h2>
        {scoredLeaders.length === 0 ? (
          <EmptyState
            title={leaders.length === 0 ? "No leaders bonded yet." : "No scored leaders yet."}
            body={leaders.length === 0
              ? "Degradation scores appear here as soon as the agent processes its first bonded leader."
              : "The first degradation scores appear after the agent commits metric evidence for the bonded leaders."}
          />
        ) : (
          <div className="card">
            {[...scoredLeaders]
              .sort((a, b) => b.degradationScore - a.degradationScore)
              .map((l) => (
                <div key={l.address} className="py-3 border-t border-line first:border-t-0">
                  <div className="flex justify-between text-sm mb-1">
                    <span>{l.handle}</span>
                    <span className="tabular">{l.degradationScore}/100</span>
                  </div>
                  <div className="h-1.5 w-full" style={{ background: "var(--border-default)" }}>
                    <div
                      className="h-full"
                      style={{
                        width: `${l.degradationScore}%`,
                        background:
                          l.degradationScore >= 50 ? "var(--status-danger)" :
                          l.degradationScore >= 25 ? "var(--accent-amber)"  :
                                                     "var(--status-good)",
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      <section className="mb-12">
        <h2 className="text-md font-bold mb-4"><span className="label mr-2">history</span> last 20 runs</h2>
        {runs.length === 0 ? (
          <EmptyState title="No agent runs yet." body="The agent will execute its first cycle once a leader is bonded." />
        ) : (
          <AgentFeed />
        )}
      </section>

      <section>
        <h2 className="text-md font-bold mb-4"><span className="label mr-2">events</span> slash log</h2>
        <div className="space-y-3">
          {slashes.length === 0 ? (
            <EmptyState title="No slash events yet." body="The agent will publish here the moment a slash fires. Every event is an on-chain transaction with an IPFS-pinned reasoning trace." />
          ) : (
            slashes.map((s) => (
              <div key={s.id} className="callout">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="font-bold">{s.handle}</span>
                  <span className="text-xs text-fg-secondary tabular">
                    {new Date(s.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm mb-2">
                  Bond slashed <span className="text-status-danger font-bold tabular">
                    {(s.slashBps / 100).toFixed(2)}%
                  </span> ({fmtUsdc(s.slashAmount, 2)} USDC) — moved to FollowerVault.
                </p>
                <div className="text-xs text-fg-tertiary tabular">
                  tx {fmtAddr(s.txHash)} · hash {fmtAddr(s.reasonHash)}
                  {s.ipfsCid && (
                    <> · <a href={`https://${s.ipfsCid}.ipfs.w3s.link/trace.json`} target="_blank" rel="noreferrer">trace ↗</a></>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}
