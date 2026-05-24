import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const ARC_RPC_URL = process.env.ARC_RPC_URL || "https://arc-node.thecanteenapp.com";
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";
const ARC_CHAIN_ID = process.env.ARC_CHAIN_ID ? Number(process.env.ARC_CHAIN_ID) : undefined;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    hardhat: {},
    localhost: { url: "http://127.0.0.1:8545" },
    arc: {
      url: ARC_RPC_URL,
      ...(ARC_CHAIN_ID ? { chainId: ARC_CHAIN_ID } : {}),
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
  },
};

export default config;
