import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Returns the leader's most recent metric history (oldest → newest), suitable
// for a sparkline. Each point is { t, sharpe, return7dBps, degradation }.
export async function GET(_: Request, ctx: { params: { address: string } }) {
  const leader = await prisma.leader.findUnique({
    where: { address: ctx.params.address.toLowerCase() },
  }).catch((error) => {
    console.error("Failed to load leader for metric history", error);
    return null;
  });
  if (!leader) return NextResponse.json({ points: [] });

  const rows = await prisma.leaderMetric.findMany({
    where: { leaderId: leader.id },
    orderBy: { computedAt: "desc" },
    take: 60,
  });

  const points = rows
    .slice()
    .reverse()
    .map((r) => ({
      t: r.computedAt.toISOString(),
      sharpe: r.sharpe30d,
      return7dBps: r.return7dBps,
      degradation: r.degradationScore,
    }));

  return NextResponse.json({ points });
}
