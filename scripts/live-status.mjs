import { createRequire } from "node:module";
import path from "node:path";

const requireFromWorkspace = createRequire(path.join(process.cwd(), "package.json"));
const { Contract, JsonRpcProvider, formatUnits } = requireFromWorkspace("ethers");

const env = process.env;
const rpcUrl = env.NEXT_PUBLIC_ARC_RPC_URL || env.ARC_RPC_URL;
const addresses = {
  LeaderOracle: env.NEXT_PUBLIC_LEADER_ORACLE_ADDRESS || env.LEADER_ORACLE_ADDRESS,
  BondRegistry: env.NEXT_PUBLIC_BOND_REGISTRY_ADDRESS || env.BOND_REGISTRY_ADDRESS,
  FollowerVault: env.NEXT_PUBLIC_FOLLOWER_VAULT_ADDRESS || env.FOLLOWER_VAULT_ADDRESS,
};

const registryAbi = [
  "function agent() view returns (address)",
  "function followerVault() view returns (address)",
  "function getAllBondedLeaders() view returns (address[])",
  "function getBond(address) view returns (tuple(uint256 amount,uint256 postedAt,uint256 lockedUntil,bool slashed,string hlWallet,string handle))",
];
const oracleAbi = [
  "function agent() view returns (address)",
  "function getLeaderState(address) view returns (tuple(address leader,int256 lastReturnBps,uint256 lastUpdated,bool flagged,bytes32 reasonHash,uint256 updateCount))",
];
const vaultAbi = [
  "function agent() view returns (address)",
  "function bondRegistry() view returns (address)",
  "function usycTeller() view returns (address)",
  "function tvl(address) view returns (uint256)",
];

function assertAddress(name, value) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value || "")) {
    throw new Error(`${name} is missing or invalid`);
  }
}

async function getDbCounts() {
  try {
    const { PrismaClient } = requireFromWorkspace("@prisma/client");
    const prisma = new PrismaClient();
    try {
      const [leaders, metrics, slashes, runs] = await Promise.all([
        prisma.leader.count(),
        prisma.leaderMetric.count(),
        prisma.slashEvent.count(),
        prisma.agentRun.count(),
      ]);
      return { ok: true, leaders, metrics, slashes, runs };
    } finally {
      await prisma.$disconnect();
    }
  } catch (e) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

async function main() {
  if (!rpcUrl) throw new Error("NEXT_PUBLIC_ARC_RPC_URL or ARC_RPC_URL is missing");
  for (const [name, value] of Object.entries(addresses)) assertAddress(name, value);

  const provider = new JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  const codeEntries = await Promise.all(
    Object.entries(addresses).map(async ([name, address]) => [
      name,
      { address, hasCode: (await provider.getCode(address)) !== "0x" },
    ]),
  );
  const contracts = Object.fromEntries(codeEntries);

  const registry = new Contract(addresses.BondRegistry, registryAbi, provider);
  const oracle = new Contract(addresses.LeaderOracle, oracleAbi, provider);
  const vault = new Contract(addresses.FollowerVault, vaultAbi, provider);

  const [registryAgent, registryVault, oracleAgent, vaultAgent, vaultRegistry, usycTeller, leaderAddresses] =
    await Promise.all([
      registry.agent(),
      registry.followerVault(),
      oracle.agent(),
      vault.agent(),
      vault.bondRegistry(),
      vault.usycTeller(),
      registry.getAllBondedLeaders(),
    ]);

  const leaders = [];
  for (const leader of leaderAddresses) {
    const [bond, state, tvl] = await Promise.all([
      registry.getBond(leader),
      oracle.getLeaderState(leader),
      vault.tvl(leader),
    ]);
    leaders.push({
      leader,
      handle: bond.handle,
      hlWallet: bond.hlWallet,
      bondUsdc: formatUnits(bond.amount, 6),
      tvlUsdc: formatUnits(tvl, 6),
      slashed: bond.slashed,
      oracleUpdates: Number(state.updateCount),
      flagged: state.flagged,
      reasonHash: state.reasonHash,
    });
  }

  const db = await getDbCounts();
  console.log(JSON.stringify({
    chainId: Number(network.chainId),
    contracts,
    wiring: {
      registryAgent,
      oracleAgent,
      vaultAgent,
      registryVault,
      vaultRegistry,
      usycTeller,
      usycEnabled: usycTeller !== "0x0000000000000000000000000000000000000000",
    },
    leaders,
    database: db,
  }, null, 2));
}

main().catch((e) => {
  console.error(e?.message ?? String(e));
  process.exit(1);
});
