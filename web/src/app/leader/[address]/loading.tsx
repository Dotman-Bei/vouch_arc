export default function Loading() {
  return (
    <>
      <div className="text-sm text-fg-secondary mb-6 inline-block">← leaderboard</div>
      <div className="counter mb-2">leader profile</div>
      <h1 className="text-xl font-bold mb-2">loading…</h1>
      <div className="text-fg-secondary text-sm mt-8">fetching on-chain bond and metrics…</div>
    </>
  );
}
