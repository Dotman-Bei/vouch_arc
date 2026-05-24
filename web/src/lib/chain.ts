import "server-only";
import { Contract, JsonRpcProvider } from "ethers";
import { LeaderOracleABI, BondRegistryABI, FollowerVaultABI } from "./abis";
import { env } from "./env";

let _provider: JsonRpcProvider | null = null;
export function provider(): JsonRpcProvider {
  if (!_provider) _provider = new JsonRpcProvider(env.arcRpcUrl());
  return _provider;
}

export function oracle()   { return new Contract(env.oracleAddress(),   LeaderOracleABI,  provider()); }
export function registry() { return new Contract(env.registryAddress(), BondRegistryABI,  provider()); }
export function vault()    { return new Contract(env.vaultAddress(),    FollowerVaultABI, provider()); }

export interface OnChainLeader {
  address: string;
  bondAmount: bigint;        // 6dp USDC
  postedAt: number;
  lockedUntil: number;
  slashed: boolean;
  hlWallet: string;
  handle: string;
  lastReturnBps: number;
  lastUpdated: number;
  flagged: boolean;
  reasonHash: string;
  updateCount: number;
  tvl: bigint;               // 6dp USDC
  returnIndex: bigint;       // 1e18-scaled
}

export async function readLeader(address: string): Promise<OnChainLeader | null> {
  try {
    const [bond, state, tvl, returnIndex] = await Promise.all([
      registry().getBond(address),
      oracle().getLeaderState(address),
      vault().tvl(address),
      vault().returnIndex(address),
    ]);
    return {
      address,
      bondAmount: bond.amount as bigint,
      postedAt: Number(bond.postedAt),
      lockedUntil: Number(bond.lockedUntil),
      slashed: bond.slashed as boolean,
      hlWallet: bond.hlWallet as string,
      handle: bond.handle as string,
      lastReturnBps: Number(state.lastReturnBps),
      lastUpdated: Number(state.lastUpdated),
      flagged: state.flagged as boolean,
      reasonHash: state.reasonHash as string,
      updateCount: Number(state.updateCount),
      tvl: tvl as bigint,
      returnIndex: returnIndex as bigint,
    };
  } catch {
    return null;
  }
}

export async function listLeaders(): Promise<string[]> {
  try {
    return (await registry().getAllBondedLeaders()) as string[];
  } catch {
    return [];
  }
}
