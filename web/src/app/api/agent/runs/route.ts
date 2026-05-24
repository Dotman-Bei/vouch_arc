import { NextResponse } from "next/server";
import { getAgentRuns } from "@/lib/leaders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const runs = await getAgentRuns(20);
  return NextResponse.json({ runs });
}
