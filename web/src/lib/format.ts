// USDC has 6 decimals. We expose numbers to the UI in human units (not wei).
const USDC_UNIT = 1_000_000n;

export function fromUsdc(n: bigint): number {
  // Use Number for display only; precision is fine up to ~9e15 USDC.
  const whole = n / USDC_UNIT;
  const frac  = Number(n % USDC_UNIT) / 1_000_000;
  return Number(whole) + frac;
}

export function toUsdc(n: number): bigint {
  return BigInt(Math.round(n * 1_000_000));
}

export function fmtUsdc(n: number, decimals = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function fmtAge(timestamp: number | string): string {
  const ts = typeof timestamp === "string" ? new Date(timestamp).getTime() : timestamp * 1000;
  const secs = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (secs < 60)    return `${secs}s ago`;
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}
