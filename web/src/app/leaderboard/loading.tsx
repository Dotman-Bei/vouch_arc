export default function Loading() {
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
      <div className="text-fg-secondary text-sm">loading leaders…</div>
    </>
  );
}
