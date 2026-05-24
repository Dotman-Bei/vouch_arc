import { NextResponse } from "next/server";
import { getLeaders } from "@/lib/leaders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const leaders = await getLeaders();
    return NextResponse.json({ leaders });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
