import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Redeploys FollowerVault with USYC disabled (usycTeller = address(0)).
 *
 * Circle's USYC teller on Arc testnet is permissioned — it rejects subscriptions
 * from the vault, so every deposit() on a USYC-enabled vault reverts. The
 * contract supports a no-USYC mode (_parkInUSYC / _redeemUSYC early-return when
 * usycTeller == address(0)); this script deploys that mode and re-wires the
 * existing BondRegistry to it. LeaderOracle and BondRegistry are untouched.
 *
 * Run:  pnpm contracts:redeploy-vault
 */
async function main() {
  const usdc         = process.env.ARC_USDC_ADDRESS;
  const usyc         = process.env.ARC_USYC_ADDRESS;
  const agent        = process.env.AGENT_ADDRESS;
  const registryAddr = process.env.BOND_REGISTRY_ADDRESS;

  if (!usdc)         throw new Error("ARC_USDC_ADDRESS missing in env");
  if (!usyc)         throw new Error("ARC_USYC_ADDRESS missing in env");
  if (!agent)        throw new Error("AGENT_ADDRESS missing in env");
  if (!registryAddr) throw new Error("BOND_REGISTRY_ADDRESS missing in env");

  const [deployer] = await ethers.getSigners();
  console.log("→ Deployer:    ", deployer.address);
  console.log("→ BondRegistry:", registryAddr);
  console.log("→ Deploying FollowerVault with usycTeller = address(0)");

  const Vault = await ethers.getContractFactory("FollowerVault");
  const vault = await Vault.deploy(usdc, usyc, ethers.ZeroAddress, agent);
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log("→ New FollowerVault:", vaultAddr);

  // Re-wire registry <-> vault (BondRegistry.setFollowerVault is owner-only).
  const registry = await ethers.getContractAt("BondRegistry", registryAddr);
  await (await registry.setFollowerVault(vaultAddr)).wait();
  await (await vault.setBondRegistry(registryAddr)).wait();
  console.log("→ Re-wired BondRegistry <-> FollowerVault");

  // Update deployments.local.json.
  const outPath = path.resolve(__dirname, "../../deployments.local.json");
  const dep = JSON.parse(fs.readFileSync(outPath, "utf8"));
  dep.FollowerVault = vaultAddr;
  dep.usycTeller    = ethers.ZeroAddress;
  dep.redeployedAt  = new Date().toISOString();
  fs.writeFileSync(outPath, JSON.stringify(dep, null, 2));
  console.log("→ Updated deployments.local.json");

  console.log("\n✓ Done. Now set these in .env:");
  console.log(`  FOLLOWER_VAULT_ADDRESS=${vaultAddr}`);
  console.log(`  NEXT_PUBLIC_FOLLOWER_VAULT_ADDRESS=${vaultAddr}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
