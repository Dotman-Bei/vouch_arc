import { NextResponse } from "next/server";
import { getSlashEvents } from "@/lib/leaders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const slashes = await getSlashEvents(20);
  return NextResponse.json({ slashes });
}
