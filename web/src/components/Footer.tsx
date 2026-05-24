export function Footer() {
  return (
    <footer className="shrink-0 border-t border-line mt-20">
      <div className="mx-auto px-6 md:px-10 py-10 text-sm" style={{ maxWidth: 860 }}>
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
          <div className="text-accent-green">
            built on arc · usdc · hyperliquid
          </div>
          <div className="flex gap-6 text-accent-green">
            <a href="https://developers.circle.com" target="_blank" rel="noreferrer">circle</a>
            <a href="https://docs.arc.network" target="_blank" rel="noreferrer">arc docs</a>
            <a href="https://thecanteenapp.com/" target="_blank" rel="noreferrer">canteen app</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
