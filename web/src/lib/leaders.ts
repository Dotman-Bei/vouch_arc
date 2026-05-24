import "server-only";
import { listLeaders, readLeader, type OnChainLeader } from "./chain";
import { prisma } from "./prisma";
import { fromUsdc } from "./format";
import type { LeaderRow, AgentRunSummary, SlashEventRow, ReasoningTraceData } from "./types";

type Verdict = "follow" | "watch" | "avoid";
const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

// Derive a verdict from on-chain `flagged` + last return when no LLM trace exists yet.
function fallbackVerdict(l: OnChainLeader): { verdict: Verdict; slashRisk: "low" | "medium" | "high" } {
  if (l.flagged)            return { verdict: "avoid",  slashRisk: "high"   };
  if (l.lastReturnBps < 0)  return { verdict: "watch",  slashRisk: "medium" };
  return                            { verdict: "follow", slashRisk: "low"    };
}

function parseTrace(traceJson?: string | null): ReasoningTraceData | null {
  if (!traceJson) return null;
  try {
    const t = JSON.parse(traceJson) as ReasoningTraceData;
    if (
      typeof t.summary === "string" &&
      Array.isArray(t.strengths) &&
      Array.isArray(t.risks) &&
      ["follow", "watch", "avoid"].includes(t.verdict) &&
      typeof t.confidence === "number" &&
      ["low", "medium", "high"].includes(t.slashRisk)
    ) return t;
  } catch {}
  return null;
}

export async function getLeaders(): Promise<LeaderRow[]> {
  const addrs = await listLeaders();
  if (addrs.length === 0) return [];

  const onchain = (await Promise.all(addrs.map(readLeader))).filter(
    (l): l is OnChainLeader => l !== null,
  );

  // Pull the most recent metric per leader in one query.
  const records = await prisma.leaderMetric.findMany({
    where: { leader: { address: { in: addrs.map(a => a.toLowerCase()) } } },
    orderBy: { computedAt: "desc" },
    include: { leader: true },
  }).catch((error) => {
    console.error("Failed to load leader metrics from database", error);
    return [];
  });

  const recordsByAddr = new Map<string, typeof records>();
  for (const m of records) {
    const key = m.leader.address.toLowerCase();
    const current = recordsByAddr.get(key) ?? [];
    current.push(m);
    recordsByAddr.set(key, current);
  }

  return onchain.map((l) => {
    const leaderRecords = recordsByAddr.get(l.address.toLowerCase()) ?? [];
    const hashMatchedMetric = l.reasonHash && l.reasonHash.toLowerCase() !== ZERO_HASH
      ? leaderRecords.find((r) => r.reasonHash.toLowerCase() === l.reasonHash.toLowerCase())
      : undefined;
    const m = hashMatchedMetric ?? leaderRecords[0];
    const fb = fallbackVerdict(l);
    const hasMetrics = Boolean(m);
    return {
      address: l.address,
      handle: l.handle || l.address.slice(0, 8),
      hlWallet: l.hlWallet,
      bondAmount: fromUsdc(l.bondAmount),
      // DB stores bondAmount in raw 6-decimal USDC units; the UI wants whole USDC.
      bondOriginal: m?.leader?.bondAmount != null
        ? Number(m.leader.bondAmount) / 1_000_000
        : fromUsdc(l.bondAmount),
      tvl: fromUsdc(l.tvl),
      hasMetrics,
      sharpe30d: m?.sharpe30d ?? 0,
      maxDrawdown: m?.maxDrawdown ?? 0,
      winRate: m?.winRate ?? 0,
      return7dBps: m?.return7dBps ?? l.lastReturnBps,
      degradationScore: m?.degradationScore ?? (l.flagged ? 50 : 0),
      verdict: hasMetrics ? ((m?.verdict as Verdict) ?? fb.verdict) : (l.flagged ? "avoid" : "watch"),
      slashRisk: (m?.slashRisk as "low" | "medium" | "high") ?? fb.slashRisk,
      confidence: m?.confidence ?? 0.5,
      reasonHash: m?.reasonHash ?? l.reasonHash,
      ipfsCid: m?.ipfsCid || null,
      reasoningTrace: parseTrace(m?.traceJson),
      lastAnalyzed: m?.computedAt.toISOString() ?? (l.lastUpdated > 0 ? new Date(l.lastUpdated * 1000).toISOString() : null),
    };
  });
}

export async function getLeader(address: string): Promise<LeaderRow | null> {
  const all = await getLeaders();
  return all.find(l => l.address.toLowerCase() === address.toLowerCase()) ?? null;
}

export async function getAgentRuns(limit = 20): Promise<AgentRunSummary[]> {
  const runs = await prisma.agentRun.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
  }).catch(() => []);
  return runs.map(r => ({
    id: r.id,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
    leadersAnalyzed: r.leadersAnalyzed,
    slashesTriggered: r.slashesTriggered,
    avgSharpe: r.avgSharpe,
    newTraces: r.newTraces,
    errors: r.errors,
  }));
}

export async function getSlashEvents(limit = 20): Promise<SlashEventRow[]> {
  const slashes = await prisma.slashEvent.findMany({
    orderBy: { timestamp: "desc" },
    take: limit,
    include: { leader: true },
  }).catch(() => []);
  return slashes.map(s => ({
    id: s.id,
    leader: s.leader.address,
    handle: s.leader.handle,
    slashBps: s.slashBps,
    slashAmount: Number(s.slashAmount) / 1_000_000,
    reasonHash: s.reasonHash,
    ipfsCid: s.ipfsCid || null,
    txHash: s.txHash,
    timestamp: s.timestamp.toISOString(),
  }));
}
