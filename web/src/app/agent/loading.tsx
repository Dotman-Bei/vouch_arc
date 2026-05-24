export default function Loading() {
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
      <div className="text-fg-secondary text-sm">loading agent activity…</div>
    </>
  );
}
