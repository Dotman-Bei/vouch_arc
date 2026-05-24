import { NextResponse } from "next/server";
import { getLeader } from "@/lib/leaders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_: Request, ctx: { params: { address: string } }) {
  const leader = await getLeader(ctx.params.address);
  if (!leader) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ leader });
}
