import { keccak256, toUtf8Bytes } from "ethers";
import { analyzeLeader, type AnalysisResult } from "./analyzer.js";
import { config } from "./config.js";
import { getLeaderBond, listLeadersOnChain } from "./dispatcher.js";
import { prisma } from "./db.js";

type Verdict = "follow" | "watch" | "avoid";
type SlashRisk = "low" | "medium" | "high";

function arg(name: string): string | undefined {
  const ix = process.argv.indexOf(`--${name}`);
  return ix >= 0 ? process.argv[ix + 1] : undefined;
}

function verdictFor(a: AnalysisResult): Verdict {
  if (a.degradationScore >= 50 || a.reliabilityScore < 70) return "avoid";
  if (a.degradationScore >= 25 || a.maxDrawdown > 0.2) return "watch";
  return "follow";
}

function slashRiskFor(a: AnalysisResult): SlashRisk {
  if (a.degradationScore >= 50 || a.reliabilityScore < 70) return "high";
  if (a.degradationScore >= 25 || a.maxDrawdown > 0.2) return "medium";
  return "low";
}

function deterministicTrace(a: AnalysisResult) {
  const verdict = verdictFor(a);
  const trace = {
    summary:
      verdict === "follow"
        ? "This leader has reliable multi-week Hyperliquid history and low measured degradation. Metrics support a follow verdict, while ongoing monitoring remains required."
        : verdict === "watch"
          ? "This leader has usable history, but risk signals are not clean enough for an automatic follow. Keep watching until degradation and drawdown improve."
          : "This leader is not suitable for following under the current evidence. Reliability, drawdown, or degradation risk is too high.",
    strengths: [
      `Reliability score ${a.reliabilityScore}/100 across ${a.coverageDays.toFixed(1)} days.`,
      `30d Sharpe ${a.sharpe30d.toFixed(2)} and profit factor ${a.profitFactor.toFixed(2)}.`,
    ],
    risks: [
      `Max drawdown ${(a.maxDrawdown * 100).toFixed(1)}%.`,
      `Win rate ${(a.winRate * 100).toFixed(0)}% across ${a.fillCount} fills.`,
      ...(a.historyCapped ? ["Hyperliquid fill history is capped; older fills may be unavailable."] : []),
    ],
    verdict,
    confidence: Math.max(0.1, Math.min(0.95, a.reliabilityScore / 100)),
    slashRisk: slashRiskFor(a),
  };
  const traceJson = JSON.stringify(trace);
  return {
    trace,
    traceJson,
    reasonHash: keccak256(toUtf8Bytes(traceJson)) as `0x${string}`,
  };
}

async function resolveLeaderAddress(): Promise<string> {
  const leader = arg("leader");
  if (leader && /^0x[a-fA-F0-9]{40}$/.test(leader)) return leader;

  const hl = arg("hl")?.toLowerCase();
  if (!hl || !/^0x[a-fA-F0-9]{40}$/.test(hl)) {
    throw new Error("Usage: tsx src/analyze-one.ts --leader 0x... OR --hl 0x...");
  }

  for (const addr of await listLeadersOnChain()) {
    const bond = await getLeaderBond(addr);
    if (bond.hlWallet.toLowerCase() === hl && bond.amount > 0n) return addr;
  }
  throw new Error(`No bonded leader found for HL wallet ${hl}`);
}

async function main() {
  const addr = await resolveLeaderAddress();
  const bond = await getLeaderBond(addr);
  if (bond.amount === 0n) throw new Error(`Leader ${addr} has no active bond`);

  const analysis = await analyzeLeader({
    leader: addr,
    hlWallet: bond.hlWallet,
    thresholdScore: config.DEGRADATION_SLASH_THRESHOLD,
    maxSlashBps: config.MAX_SLASH_BPS,
  });
  const trace = deterministicTrace(analysis);

  const leaderRow = await prisma.leader.upsert({
    where: { address: addr.toLowerCase() },
    create: {
      address: addr.toLowerCase(),
      hlWallet: bond.hlWallet,
      handle: bond.handle,
      bondAmount: bond.amount.toString(),
      lastAnalyzed: new Date(),
    },
    update: {
      hlWallet: bond.hlWallet,
      handle: bond.handle,
      bondAmount: bond.amount.toString(),
      lastAnalyzed: new Date(),
    },
  });

  await prisma.leaderMetric.create({
    data: {
      leaderId: leaderRow.id,
      sharpe30d: analysis.sharpe30d,
      sortino30d: analysis.sortino30d,
      maxDrawdown: analysis.maxDrawdown,
      winRate: analysis.winRate,
      profitFactor: analysis.profitFactor,
      return24hBps: analysis.return24hBps,
      return7dBps: analysis.return7dBps,
      regimeAlpha: analysis.regimeAlpha,
      degradationScore: analysis.degradationScore,
      verdict: trace.trace.verdict,
      confidence: trace.trace.confidence,
      slashRisk: trace.trace.slashRisk,
      reasonHash: trace.reasonHash,
      ipfsCid: "",
      traceJson: trace.traceJson,
    },
  });

  console.log(JSON.stringify({
    leader: addr,
    hlWallet: bond.hlWallet,
    handle: bond.handle,
    verdict: trace.trace.verdict,
    degradationScore: analysis.degradationScore,
    reliabilityScore: analysis.reliabilityScore,
    coverageDays: analysis.coverageDays,
    historyCapped: analysis.historyCapped,
    reasonHash: trace.reasonHash,
    dispatched: false,
  }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
