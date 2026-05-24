import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { BondRegistryABI, FollowerVaultABI, LeaderOracleABI } from "./abis.js";
import type { AnalysisResult } from "./analyzer.js";
import type { ReasoningResult } from "./reasoner.js";

export interface DispatchResult {
  leader: string;
  oracleTx?: string;
  vaultTx?: string;
  slashTx?: string;
  slashed: boolean;
  slashBps: number;   // bps actually slashed (0 if none)
  error?: string;
}

const MAX_SLASH_BPS = 8000;

/// Resolve the slash decision from both signals: the rule-based degradation
/// score and the LLM verdict. The rule engine can miss integrity problems an
/// analyst would catch (wash trading, fabricated stats); when the LLM returns
/// an "avoid" verdict with "high" slash risk, that is itself slashable, scaled
/// by the LLM's own confidence.
function resolveSlash(a: AnalysisResult, r: ReasoningResult): { degraded: boolean; slashBps: number } {
  if (a.degraded && a.slashBps > 0) {
    return { degraded: true, slashBps: Math.min(a.slashBps, MAX_SLASH_BPS) };
  }
  if (r.trace.verdict === "avoid" && r.trace.slashRisk === "high") {
    const bps = Math.min(Math.round(r.trace.confidence * MAX_SLASH_BPS), MAX_SLASH_BPS);
    if (bps > 0) return { degraded: true, slashBps: bps };
  }
  return { degraded: a.degraded, slashBps: 0 };
}

const provider = new JsonRpcProvider(config.ARC_RPC_URL);
const wallet   = new Wallet(config.AGENT_PRIVATE_KEY, provider);

export const oracle   = new Contract(config.LEADER_ORACLE_ADDRESS,  LeaderOracleABI,  wallet);
export const registry = new Contract(config.BOND_REGISTRY_ADDRESS,  BondRegistryABI,  wallet);
export const vault    = new Contract(config.FOLLOWER_VAULT_ADDRESS, FollowerVaultABI, wallet);

export async function listLeadersOnChain(): Promise<string[]> {
  return await registry.getAllBondedLeaders();
}

export async function getLeaderBond(addr: string): Promise<{ amount: bigint; hlWallet: string; handle: string; slashed: boolean }> {
  const b = await registry.getBond(addr);
  return { amount: b.amount as bigint, hlWallet: b.hlWallet as string, handle: b.handle as string, slashed: b.slashed as boolean };
}

export async function dispatch(a: AnalysisResult, r: ReasoningResult): Promise<DispatchResult> {
  const out: DispatchResult = { leader: a.leader, slashed: false, slashBps: 0 };
  const { degraded, slashBps } = resolveSlash(a, r);
  try {
    // 1. Always push oracle update.
    const tx1 = await oracle.pushUpdate(a.leader, a.return24hBps, degraded, r.reasonHash);
    await tx1.wait();
    out.oracleTx = tx1.hash;

    // 2. Move follower vault index.
    const tx2 = await vault.updateReturnIndex(a.leader, a.return24hBps);
    await tx2.wait();
    out.vaultTx = tx2.hash;

    // 3. Slash if degraded and the leader still has bond.
    if (degraded && slashBps > 0) {
      const bond = await getLeaderBond(a.leader);
      if (bond.amount === 0n) {
        logger.warn({ leader: a.leader }, "degraded but bond exhausted, skipping slash");
      } else {
        const tx3 = await registry.slash(a.leader, slashBps, r.reasonHash);
        await tx3.wait();
        out.slashTx = tx3.hash;
        out.slashed = true;
        out.slashBps = slashBps;
      }
    }
  } catch (e: any) {
    out.error = e?.shortMessage ?? String(e);
    logger.error({ leader: a.leader, err: out.error }, "dispatch failed");
  }
  return out;
}

export { wallet, provider };
