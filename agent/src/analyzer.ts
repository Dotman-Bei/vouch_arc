import { getUserFillsHistory, type HLFill } from "./hyperliquid.js";
import { logger } from "./logger.js";

export interface AnalysisResult {
  leader: string;            // EVM address
  hlWallet: string;
  sharpe30d: number;
  sortino30d: number;
  maxDrawdown: number;       // 0..1
  winRate: number;           // 0..1
  profitFactor: number;
  return24hBps: number;      // basis points
  return7dBps: number;
  regimeAlpha: number;
  positionConc: number;
  fillCount: number;
  coverageDays: number;      // calendar span of the fills actually available
  historyCapped: boolean;
  reliabilityScore: number;  // 0..100
  degradationScore: number;  // 0..100
  degraded: boolean;
  slashBps: number;          // 0..MAX_SLASH_BPS
}

// Hyperliquid's userFills endpoint caps at 2000 fills. A high-frequency wallet
// burns that cap in minutes, so we get no real multi-day history. With no
// verifiable track record the 30d metrics are meaningless — the daily buckets
// collapse into one and produce a fake-perfect profile. We treat such a leader
// as unproven (high degradation) rather than trusting the degenerate score.
const MIN_COVERAGE_DAYS = 14;
const UNPROVEN_DEGRADATION = 60;
const CAPPED_HISTORY_DEGRADATION = 70;

// ── stat helpers ──────────────────────────────────────────────────────────
const mean    = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const std     = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};
const downStd = (xs: number[]) => {
  const neg = xs.filter(x => x < 0);
  return std(neg);
};

// Bucket fills into daily PnL buckets (UTC). Returns array of daily PnL deltas
// over the last `days` days, oldest first.
function bucketDailyPnl(fills: HLFill[], days: number): number[] {
  const now = Date.now();
  const dayMs = 86_400_000;
  const buckets: Record<number, number> = {};
  for (let i = 0; i < days; i++) buckets[i] = 0;
  for (const f of fills) {
    const age = now - f.time;
    if (age < 0 || age > days * dayMs) continue;
    const idx = days - 1 - Math.floor(age / dayMs);
    if (idx < 0 || idx >= days) continue;
    buckets[idx] += Number(f.closedPnl) - Number(f.fee);
  }
  return Object.values(buckets);
}

function rangePnl(fills: HLFill[], sinceMs: number): number {
  return fills
    .filter(f => f.time >= sinceMs)
    .reduce((a, f) => a + Number(f.closedPnl) - Number(f.fee), 0);
}

function maxDrawdownFrom(daily: number[]): number {
  let equity = 0, peak = 0, mdd = 0;
  for (const d of daily) {
    equity += d;
    if (equity > peak) peak = equity;
    const dd = peak === 0 ? 0 : (peak - equity) / Math.max(peak, 1);
    if (dd > mdd) mdd = dd;
  }
  return mdd;
}

// ── degradation score ─────────────────────────────────────────────────────
export function computeDegradationScore(m: Omit<AnalysisResult, "degradationScore" | "degraded" | "slashBps" | "leader" | "hlWallet">): number {
  let score = 0;
  if (m.sharpe30d   < 0.5)   score += 25;
  if (m.sharpe30d   < 0.0)   score += 25;
  if (m.maxDrawdown > 0.20)  score += 20;
  if (m.maxDrawdown > 0.35)  score += 20;
  if (m.winRate     < 0.40)  score += 15;
  if (m.profitFactor < 1.0)  score += 15;
  if (m.return7dBps < -1000) score += 10;
  if (m.reliabilityScore < 70) score += 20;
  if (m.reliabilityScore < 40) score += 20;
  return Math.min(score, 100);
}

function computeReliabilityScore(args: {
  fillCount: number;
  coverageDays: number;
  historyCapped: boolean;
}): number {
  const coverageScore = Math.min(args.coverageDays / 30, 1) * 70;
  const sampleScore = Math.min(args.fillCount / 250, 1) * 20;
  const capPenalty = args.historyCapped ? 30 : 0;
  const sparsePenalty = args.fillCount < 20 ? 20 : 0;
  return Math.max(0, Math.min(100, Math.round(coverageScore + sampleScore + 10 - capPenalty - sparsePenalty)));
}

export async function analyzeLeader(args: {
  leader: string;
  hlWallet: string;
  bondAmount?: number; // for sizing context; not currently used in score
  thresholdScore: number;
  maxSlashBps: number;
}): Promise<AnalysisResult> {
  const since30d = Date.now() - 30 * 86_400_000;
  const history = await getUserFillsHistory(args.hlWallet, since30d, Date.now());
  const fills = history.fills;
  if (fills.length === 0) {
    logger.warn({ leader: args.leader, hl: args.hlWallet }, "HL returned no fills for 30d window");
  }

  // How much calendar time the available fills actually span. If the API's
  // 2000-fill cap leaves us with only a sliver, the 30d stats can't be trusted.
  let minT = Infinity, maxT = -Infinity;
  for (const f of fills) {
    if (f.time < minT) minT = f.time;
    if (f.time > maxT) maxT = f.time;
  }
  const coverageDays = fills.length >= 2 ? (maxT - minT) / 86_400_000 : 0;
  const reliabilityScore = computeReliabilityScore({
    fillCount: fills.length,
    coverageDays,
    historyCapped: history.capped,
  });
  const insufficientData = fills.length === 0 || coverageDays < MIN_COVERAGE_DAYS || reliabilityScore < 70;
  if (insufficientData) {
    logger.warn(
      {
        leader: args.leader,
        hl: args.hlWallet,
        fills: fills.length,
        coverageDays,
        capped: history.capped,
        requests: history.requests,
        reliabilityScore,
      },
      "insufficient HL history - metrics reliability below threshold",
    );
  }

  const daily = bucketDailyPnl(fills, 30);
  const dailyMean = mean(daily);
  const dailyStd  = std(daily);
  const dailyDS   = downStd(daily);

  const sharpe30d  = dailyStd === 0 ? 0 : (dailyMean / dailyStd) * Math.sqrt(252);
  const sortino30d = dailyDS  === 0 ? 0 : (dailyMean / dailyDS)  * Math.sqrt(252);
  const maxDD      = maxDrawdownFrom(daily);

  const winDays  = daily.filter(d => d > 0);
  const lossDays = daily.filter(d => d < 0);
  const winRate  = (winDays.length + lossDays.length) === 0
    ? 0 : winDays.length / (winDays.length + lossDays.length);
  const gainsAbs = winDays.reduce((a, x) => a + x, 0);
  const lossAbs  = Math.abs(lossDays.reduce((a, x) => a + x, 0));
  const profitFactor = lossAbs === 0 ? (gainsAbs > 0 ? 10 : 0) : gainsAbs / lossAbs;

  // Notional anchor for bps — uses sum of |daily| as a crude rolling base.
  const base = daily.reduce((a, x) => a + Math.abs(x), 0) || 1;
  const pnl24h = rangePnl(fills, Date.now() - 86_400_000);
  const pnl7d  = rangePnl(fills, Date.now() - 7 * 86_400_000);
  const return24hBps = Math.round((pnl24h / base) * 10_000);
  const return7dBps  = Math.round((pnl7d  / base) * 10_000);

  const partial = {
    sharpe30d, sortino30d, maxDrawdown: maxDD, winRate, profitFactor,
    return24hBps, return7dBps,
    regimeAlpha: 0,
    positionConc: 0,
    fillCount: fills.length,
    coverageDays,
    historyCapped: history.capped,
    reliabilityScore,
  };
  let degradationScore = computeDegradationScore(partial);
  // A leader with no verifiable multi-day track record cannot be trusted with
  // follower capital — floor the score so the degenerate "perfect" metrics
  // can't read as low-risk.
  if (insufficientData) {
    degradationScore = Math.max(degradationScore, UNPROVEN_DEGRADATION);
  }
  if (history.capped && coverageDays < MIN_COVERAGE_DAYS) {
    degradationScore = Math.max(degradationScore, CAPPED_HISTORY_DEGRADATION);
  }
  const degraded = degradationScore >= args.thresholdScore;
  const slashBps = Math.min(degradationScore * 100, args.maxSlashBps);

  return {
    leader: args.leader,
    hlWallet: args.hlWallet,
    ...partial,
    degradationScore,
    degraded,
    slashBps: degraded ? slashBps : 0,
  };
}
