import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const agent      = process.env.AGENT_ADDRESS || deployer.address;
  const usdc       = process.env.ARC_USDC_ADDRESS;
  const usyc       = process.env.ARC_USYC_ADDRESS;
  const rawTeller  = process.env.ARC_USYC_TELLER_ADDRESS;
  const enableUsyc = process.env.ARC_ENABLE_USYC_TELLER === "true";
  const usycTeller = enableUsyc ? rawTeller : ethers.ZeroAddress;

  if (!usdc) throw new Error("ARC_USDC_ADDRESS missing in env");
  if (!usyc) throw new Error("ARC_USYC_ADDRESS missing in env");
  if (enableUsyc && !rawTeller) throw new Error("ARC_USYC_TELLER_ADDRESS missing in env");

  console.log("→ Deployer:", deployer.address);
  console.log("→ Agent:   ", agent);
  console.log("→ USDC:    ", usdc);
  console.log("→ USYC:    ", usyc);
  console.log("→ USYC teller:", usycTeller, enableUsyc ? "(enabled)" : "(disabled)");

  const Oracle   = await ethers.getContractFactory("LeaderOracle");
  const oracle   = await Oracle.deploy(agent);
  await oracle.waitForDeployment();

  const Vault    = await ethers.getContractFactory("FollowerVault");
  const vault    = await Vault.deploy(usdc, usyc, usycTeller, agent);
  await vault.waitForDeployment();

  const Registry = await ethers.getContractFactory("BondRegistry");
  const registry = await Registry.deploy(usdc, agent);
  await registry.waitForDeployment();

  // Wire it up.
  await (await registry.setFollowerVault(await vault.getAddress())).wait();
  await (await vault.setBondRegistry(await registry.getAddress())).wait();

  const out = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    agent,
    usdc,
    usyc,
    usycTeller,
    LeaderOracle:  await oracle.getAddress(),
    FollowerVault: await vault.getAddress(),
    BondRegistry:  await registry.getAddress(),
    deployedAt: new Date().toISOString(),
  };

  console.log("\n=== Vouch deployed ===");
  console.table(out);

  const outPath = path.resolve(__dirname, "../../deployments.local.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("→ Wrote", outPath);
}

main().catch((e) => { console.error(e); process.exit(1); });
