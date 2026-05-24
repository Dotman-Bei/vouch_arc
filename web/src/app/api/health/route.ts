import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const requiredEnv = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_ARC_RPC_URL",
  "NEXT_PUBLIC_LEADER_ORACLE_ADDRESS",
  "NEXT_PUBLIC_BOND_REGISTRY_ADDRESS",
  "NEXT_PUBLIC_FOLLOWER_VAULT_ADDRESS",
  "NEXT_PUBLIC_USDC_ADDRESS",
  "NEXT_PUBLIC_USYC_ADDRESS",
  "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID",
];

export async function GET() {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  let database: { ok: boolean; error?: string } = { ok: false };

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = { ok: true };
  } catch (error) {
    database = {
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 240) : "unknown database error",
    };
  }

  return NextResponse.json({
    ok: missing.length === 0 && database.ok,
    missing,
    database,
    checkedAt: new Date().toISOString(),
  });
}
