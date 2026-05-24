import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Seeds a demo leader: approves USDC and posts a performance bond to
 * BondRegistry. The signer (DEPLOYER_PRIVATE_KEY on the `arc` network)
 * becomes the on-chain leader.
 *
 * Configure via env (see .env):
 *   SEED_HL_WALLET   Hyperliquid address the agent will analyze   (required)
 *   SEED_HANDLE      display handle for the leaderboard           (default: "Demo Leader")
 *   SEED_BOND_USDC   bond size in whole USDC                      (default: 100)
 *
 * Run:  pnpm contracts:seed
 */
async function main() {
  const registryAddr = process.env.BOND_REGISTRY_ADDRESS || readDeployments()?.BondRegistry;
  const usdcAddr     = process.env.ARC_USDC_ADDRESS;
  const hlWallet     = process.env.SEED_HL_WALLET;
  const handle       = process.env.SEED_HANDLE || "Demo Leader";
  const bondUsdc     = process.env.SEED_BOND_USDC || "100";

  if (!registryAddr) throw new Error("BOND_REGISTRY_ADDRESS missing (env or deployments.local.json)");
  if (!usdcAddr)     throw new Error("ARC_USDC_ADDRESS missing in env");
  if (!hlWallet)     throw new Error("SEED_HL_WALLET missing in env — the Hyperliquid address to track");

  const [leader] = await ethers.getSigners();
  const amount   = ethers.parseUnits(bondUsdc, 6); // USDC has 6 decimals

  const usdc = await ethers.getContractAt(
    [
      "function balanceOf(address) view returns (uint256)",
      "function allowance(address,address) view returns (uint256)",
      "function approve(address,uint256) returns (bool)",
    ],
    usdcAddr,
  );
  const registry = await ethers.getContractAt("BondRegistry", registryAddr);

  console.log("→ Leader (signer):", leader.address);
  console.log("→ BondRegistry:   ", registryAddr);
  console.log("→ HL wallet:      ", hlWallet);
  console.log("→ Handle:         ", handle);
  console.log("→ Bond:           ", bondUsdc, "USDC");

  const existing = await registry.getBond(leader.address);
  if (existing.amount > 0n) {
    console.log(`\n✓ Bond already exists for ${leader.address} — ${ethers.formatUnits(existing.amount, 6)} USDC. Nothing to do.`);
    return;
  }

  const minBond = await registry.MIN_BOND();
  if (amount < minBond) {
    throw new Error(`Bond ${bondUsdc} USDC is below MIN_BOND (${ethers.formatUnits(minBond, 6)} USDC).`);
  }

  const balance = await usdc.balanceOf(leader.address);
  if (balance < amount) {
    throw new Error(
      `Insufficient USDC: have ${ethers.formatUnits(balance, 6)}, need ${bondUsdc}. ` +
      `Fund ${leader.address} with Arc testnet USDC and retry.`,
    );
  }

  const allowance = await usdc.allowance(leader.address, registryAddr);
  if (allowance < amount) {
    console.log("\n→ Approving USDC…");
    await (await usdc.approve(registryAddr, amount)).wait();
    console.log("  approved.");
  }

  console.log("→ Posting bond…");
  const tx = await registry.postBond(amount, hlWallet, handle);
  const receipt = await tx.wait();
  console.log(`\n✓ Bond posted. tx: ${receipt?.hash}`);
  console.log(`  Leader ${leader.address} is now live. Run the agent: pnpm agent:run`);
}

function readDeployments(): Record<string, string> | null {
  const p = path.resolve(__dirname, "../../deployments.local.json");
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
}

main().catch((e) => { console.error(e); process.exit(1); });
