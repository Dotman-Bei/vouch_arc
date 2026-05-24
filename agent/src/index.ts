import cron from "node-cron";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { analyzeLeader } from "./analyzer.js";
import { reason } from "./reasoner.js";
import { dispatch, listLeadersOnChain, getLeaderBond } from "./dispatcher.js";
import { notifySlash } from "./notify.js";
import { prisma } from "./db.js";

const MINUTE_MS = 60_000;

async function shouldAnalyzeLeader(addr: string, force = false): Promise<{ analyze: boolean; reason: string }> {
  if (force) return { analyze: true, reason: "forced" };

  const row = await prisma.leader.findUnique({
    where: { address: addr.toLowerCase() },
    select: {
      metrics: {
        orderBy: { computedAt: "desc" },
        take: 1,
        select: { computedAt: true },
      },
    },
  });

  const latestMetricAt = row?.metrics[0]?.computedAt ?? null;
  if (!latestMetricAt) return { analyze: true, reason: "new leader" };

  const minAgeMs = config.AGENT_MIN_ANALYSIS_INTERVAL_MINUTES * MINUTE_MS;
  const ageMs = Date.now() - latestMetricAt.getTime();
  if (ageMs >= minAgeMs) return { analyze: true, reason: "monitoring interval elapsed" };

  return { analyze: false, reason: "recently analyzed" };
}

async function runCycle(force = false) {
  const run = await prisma.agentRun.create({ data: {} }).catch((e) => {
    logger.error({ err: e?.message ?? String(e) }, "database unavailable");
    return null;
  });
  if (!run) {
    logger.error("cycle aborted before on-chain writes because database persistence is unavailable");
    return;
  }

  const errors: string[] = [];
  let analyzed = 0;
  let slashes  = 0;
  let traces   = 0;
  let sharpeSum = 0;
  let skipped = 0;

  try {
    const leaders = await listLeadersOnChain();
    logger.info({ count: leaders.length }, "→ cycle start");

    // BondRegistry is the source of truth for participation. Freshly bonded
    // leaders must be analyzed before they have any oracle state.
    for (const addr of leaders) {
      try {
        const bond = await getLeaderBond(addr);
        if (bond.amount === 0n) continue;

        const decision = await shouldAnalyzeLeader(addr, force);
        if (!decision.analyze) {
          skipped++;
          logger.info({ leader: addr, reason: decision.reason }, "leader skipped");
          continue;
        }

        logger.info({ leader: addr, reason: decision.reason }, "leader queued for analysis");

        const analysis = await analyzeLeader({
          leader: addr,
          hlWallet: bond.hlWallet,
          thresholdScore: config.DEGRADATION_SLASH_THRESHOLD,
          maxSlashBps: config.MAX_SLASH_BPS,
        });

        const trace = await reason(analysis);

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
        }).catch((e) => { errors.push(`upsert ${addr}: ${e}`); return null; });
        if (!leaderRow) continue;

        const metricRow = await prisma.leaderMetric.create({
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
            ipfsCid: trace.ipfsCid ?? "",
            traceJson: trace.traceJson,
          },
        }).catch((e) => { errors.push(`metric ${addr}: ${e}`); return null; });
        if (!metricRow) continue;

        const dispatch_ = await dispatch(analysis, trace);
        if (dispatch_.error) errors.push(`dispatch ${addr}: ${dispatch_.error}`);

        analyzed++;
        sharpeSum += analysis.sharpe30d;
        traces++;
        if (dispatch_.slashed) slashes++;

        if (dispatch_.slashed && dispatch_.slashTx) {
          const receipt = await import("./dispatcher.js").then(m =>
            m.provider.getTransactionReceipt(dispatch_.slashTx!));
          await prisma.slashEvent.create({
            data: {
              leaderId: leaderRow.id,
              slashBps: dispatch_.slashBps,
              slashAmount: ((bond.amount * BigInt(dispatch_.slashBps)) / 10000n).toString(),
              reasonHash: trace.reasonHash,
              ipfsCid: trace.ipfsCid ?? "",
              txHash: dispatch_.slashTx,
              blockNumber: BigInt(receipt?.blockNumber ?? 0),
            },
          }).catch((e) => errors.push(`slashEvent ${addr}: ${e}`));
          await notifySlash(analysis, dispatch_, bond.handle);
        }

        logger.info({
          leader: addr, score: analysis.degradationScore, verdict: trace.trace.verdict,
          slashed: dispatch_.slashed,
        }, "✓ leader processed");
      } catch (e: any) {
        errors.push(`${addr}: ${e?.message ?? String(e)}`);
        logger.error({ addr, err: String(e) }, "leader cycle failed");
      }
    }
  } catch (e: any) {
    errors.push(`fatal: ${e?.message ?? String(e)}`);
    logger.error({ err: String(e) }, "cycle fatal");
  }

  if (run) {
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        leadersAnalyzed: analyzed,
        slashesTriggered: slashes,
        avgSharpe: analyzed > 0 ? sharpeSum / analyzed : 0,
        newTraces: traces,
        errors,
      },
    }).catch(() => null);
  }

  logger.info({ analyzed, slashes, traces, errs: errors.length }, "→ cycle done");
}

async function main() {
  const once = process.argv.includes("--once");
  const force = process.argv.includes("--force");
  if (once) {
    await runCycle(force);
    process.exit(0);
  }
  logger.info({
    schedule: config.AGENT_CRON,
    minIntervalMinutes: config.AGENT_MIN_ANALYSIS_INTERVAL_MINUTES,
  }, "Vouch agent scheduled");
  cron.schedule(config.AGENT_CRON, () => {
    runCycle().catch((e) => logger.error({ err: String(e) }, "cron run failed"));
  });
  // Kick off one immediate run.
  await runCycle(force);
}

main().catch((e) => { logger.error({ err: String(e) }, "fatal"); process.exit(1); });
