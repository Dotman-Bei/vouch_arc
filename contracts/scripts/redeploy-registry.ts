import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Redeploys BondRegistry (e.g. after changing the MIN_BOND constant) and
 * re-wires it to the existing FollowerVault. LeaderOracle is untouched.
 *
 * A fresh BondRegistry has no bonded leaders — re-seed afterwards with
 * `pnpm contracts:seed`.
 *
 * Run:  pnpm contracts:redeploy-registry
 */
async function main() {
  const usdc      = process.env.ARC_USDC_ADDRESS;
  const agent     = process.env.AGENT_ADDRESS;
  const vaultAddr = process.env.FOLLOWER_VAULT_ADDRESS;

  if (!usdc)      throw new Error("ARC_USDC_ADDRESS missing in env");
  if (!agent)     throw new Error("AGENT_ADDRESS missing in env");
  if (!vaultAddr) throw new Error("FOLLOWER_VAULT_ADDRESS missing in env");

  const [deployer] = await ethers.getSigners();
  console.log("→ Deployer:     ", deployer.address);
  console.log("→ FollowerVault:", vaultAddr);
  console.log("→ Deploying BondRegistry");

  const Registry = await ethers.getContractFactory("BondRegistry");
  const registry = await Registry.deploy(usdc, agent);
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("→ New BondRegistry:", registryAddr);
  console.log("→ MIN_BOND:", ethers.formatUnits(await registry.MIN_BOND(), 6), "USDC");

  // Re-wire registry <-> vault.
  await (await registry.setFollowerVault(vaultAddr)).wait();
  const vault = await ethers.getContractAt("FollowerVault", vaultAddr);
  await (await vault.setBondRegistry(registryAddr)).wait();
  console.log("→ Re-wired BondRegistry <-> FollowerVault");

  // Update deployments.local.json.
  const outPath = path.resolve(__dirname, "../../deployments.local.json");
  const dep = JSON.parse(fs.readFileSync(outPath, "utf8"));
  dep.BondRegistry = registryAddr;
  dep.redeployedAt = new Date().toISOString();
  fs.writeFileSync(outPath, JSON.stringify(dep, null, 2));
  console.log("→ Updated deployments.local.json");

  console.log("\n✓ Done. Now set these in .env:");
  console.log(`  BOND_REGISTRY_ADDRESS=${registryAddr}`);
  console.log(`  NEXT_PUBLIC_BOND_REGISTRY_ADDRESS=${registryAddr}`);
  console.log("Then re-seed the demo leader:  pnpm contracts:seed");
}

main().catch((e) => { console.error(e); process.exit(1); });
