import { NextResponse } from "next/server";
import { listLeaders, vault, readLeader } from "@/lib/chain";
import { fromUsdc } from "@/lib/format";

export const runtime = "nodejs";

// Positions for a given wallet address (?address=0x..). Read-only on-chain.
export async function GET(req: Request) {
  try {
    const address = new URL(req.url).searchParams.get("address");
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ wallet: null, positions: [] });
    }

    const addrs = await listLeaders();
    const positions = await Promise.all(addrs.map(async (leader) => {
      const [sharesBn, valueBn] = await Promise.all([
        vault().shares(address, leader) as Promise<bigint>,
        vault().positionValue(address, leader) as Promise<bigint>,
      ]);
      if (sharesBn === 0n) return null;
      const onchain = await readLeader(leader);
      return {
        leader,
        handle: onchain?.handle || leader.slice(0, 8),
        shares: sharesBn.toString(),
        value: fromUsdc(valueBn),
      };
    }));

    return NextResponse.json({
      wallet: { address },
      positions: positions.filter(Boolean),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
