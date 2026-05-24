import { expect } from "chai";
import { ethers } from "hardhat";

const U = (n: number | string) => ethers.parseUnits(String(n), 6);

describe("Vouch — end-to-end mechanism", () => {
  async function setup() {
    const [deployer, agent, leader, alice, bob] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await USDC.deploy();

    const Oracle   = await ethers.getContractFactory("LeaderOracle");
    const oracle   = await Oracle.deploy(agent.address);
    const Vault    = await ethers.getContractFactory("FollowerVault");
    const vault    = await Vault.deploy(await usdc.getAddress(), ethers.ZeroAddress, ethers.ZeroAddress, agent.address);
    const Registry = await ethers.getContractFactory("BondRegistry");
    const registry = await Registry.deploy(await usdc.getAddress(), agent.address);

    await registry.setFollowerVault(await vault.getAddress());
    await vault.setBondRegistry(await registry.getAddress());

    for (const a of [leader, alice, bob]) {
      await usdc.mint(a.address, U(10_000));
      await usdc.connect(a).approve(await registry.getAddress(), ethers.MaxUint256);
      await usdc.connect(a).approve(await vault.getAddress(),    ethers.MaxUint256);
    }

    return { deployer, agent, leader, alice, bob, usdc, oracle, vault, registry };
  }

  it("leader posts a bond, agent updates oracle, follower deposits, agent slashes, follower made whole", async () => {
    const { agent, leader, alice, vault, registry, oracle, usdc } = await setup();

    await registry.connect(leader).postBond(U(1000), "0xHL_LEADER", "@whale");
    expect((await registry.getBond(leader.address)).amount).to.equal(U(1000));
    expect(await registry.getBondedLeaderCount()).to.equal(1);
    expect(await registry.getAllBondedLeaders()).to.deep.equal([leader.address]);

    const reason = ethers.keccak256(ethers.toUtf8Bytes("first push"));
    await oracle.connect(agent).pushUpdate(leader.address, 150, false, reason);
    const s = await oracle.getLeaderState(leader.address);
    expect(s.lastReturnBps).to.equal(150);
    expect(s.updateCount).to.equal(1);

    await vault.connect(alice).deposit(leader.address, U(500));
    expect(await vault.positionValue(alice.address, leader.address)).to.equal(U(500));

    // Leader loses 10% — index drops to 0.9
    await vault.connect(agent).updateReturnIndex(leader.address, -1000);
    const valAfterLoss = await vault.positionValue(alice.address, leader.address);
    expect(valAfterLoss).to.equal(U(450));

    // Agent slashes 30% of bond → 300 USDC into vault → index bumps by 300/500 = 0.6
    const slashReason = ethers.keccak256(ethers.toUtf8Bytes("degraded"));
    await registry.connect(agent).slash(leader.address, 3000, slashReason);

    const valAfterSlash = await vault.positionValue(alice.address, leader.address);
    // 450 + 300 = 750 (full make-whole + bonus from slash overflow)
    expect(valAfterSlash).to.equal(U(750));

    expect((await registry.getBond(leader.address)).amount).to.equal(U(700));
    expect((await registry.getBond(leader.address)).slashed).to.equal(true);

    // Alice withdraws — receives her made-whole value (capped at real backing).
    const aliceBefore = await usdc.balanceOf(alice.address);
    await vault.connect(alice).withdraw(leader.address, U(500));
    expect((await usdc.balanceOf(alice.address)) - aliceBefore).to.equal(U(750));
    expect(await vault.shares(alice.address, leader.address)).to.equal(0n);
  });

  it("withdrawal is capped at real backing — synthetic index gains are unfunded", async () => {
    const { agent, leader, alice, vault, registry, usdc } = await setup();

    await registry.connect(leader).postBond(U(1000), "0xHL", "@x");
    await vault.connect(alice).deposit(leader.address, U(100));

    // Agent reports +50% — the index inflates synthetically, no real USDC behind it.
    await vault.connect(agent).updateReturnIndex(leader.address, 5000);
    expect(await vault.positionValue(alice.address, leader.address)).to.equal(U(150));

    // Withdrawal returns only the real 100 USDC, not the synthetic 150.
    const before = await usdc.balanceOf(alice.address);
    await vault.connect(alice).withdraw(leader.address, U(100));
    expect((await usdc.balanceOf(alice.address)) - before).to.equal(U(100));
  });

  it("only the agent can push or slash", async () => {
    const { deployer, leader, registry, oracle } = await setup();
    const reason = ethers.keccak256(ethers.toUtf8Bytes("x"));
    await expect(oracle.connect(deployer).pushUpdate(leader.address, 1, false, reason))
      .to.be.revertedWith("not agent");
    await registry.connect(leader).postBond(U(500), "0xHL", "@x");
    await expect(registry.connect(deployer).slash(leader.address, 100, reason))
      .to.be.revertedWith("not agent");
  });

  it("rejects bond below minimum and double-posting", async () => {
    const { leader, registry } = await setup();
    await expect(registry.connect(leader).postBond(U(10), "0xHL", "@x"))
      .to.be.revertedWith("below minimum");
    await registry.connect(leader).postBond(U(200), "0xHL", "@x");
    await expect(registry.connect(leader).postBond(U(200), "0xHL", "@x"))
      .to.be.revertedWith("bond exists");
  });
});
