import { NextResponse } from "next/server";
import { keccak256, toUtf8Bytes } from "ethers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Returns the full LLM reasoning trace JSON for a given on-chain reasonHash.
// Also re-verifies the hash so the client can confirm the bytes match what the
// agent committed on-chain. This is what makes the agentic decisions auditable
// without a trusted IPFS gateway.
export async function GET(_: Request, ctx: { params: { hash: string } }) {
  const hash = ctx.params.hash.toLowerCase();
  const metric = await prisma.leaderMetric.findFirst({
    where: { reasonHash: hash },
    orderBy: { computedAt: "desc" },
  }).catch(() => null);

  if (!metric || !metric.traceJson) {
    return NextResponse.json({ error: "trace not found" }, { status: 404 });
  }

  const recomputed = keccak256(toUtf8Bytes(metric.traceJson)).toLowerCase();
  const verified   = recomputed === hash;

  return NextResponse.json({
    reasonHash: metric.reasonHash,
    computedAt: metric.computedAt.toISOString(),
    ipfsCid: metric.ipfsCid || null,
    trace: JSON.parse(metric.traceJson),
    traceJson: metric.traceJson,
    verified,
  });
}
