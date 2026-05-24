import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const envPath = path.join(root, ".env");

const phases = new Set(process.argv.slice(2));
if (phases.size === 0) phases.add("all");

const wants = (phase) => phases.has("all") || phases.has(phase);

function parseEnv(file) {
  if (!fs.existsSync(file)) return null;
  const out = {};
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = parseEnv(envPath);
if (!env) {
  console.error("Missing .env in project root.");
  console.error("Create it from .env.example, then fill real Arc/Circle/agent values.");
  process.exit(1);
}

const checks = [];

function requireVar(phase, key, validate) {
  checks.push({ phase, key, validate });
}

function isUrl(v) {
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
}

const isAddress = (v) => /^0x[a-fA-F0-9]{40}$/.test(v);
const isPrivateKey = (v) => /^(0x)?[a-fA-F0-9]{64}$/.test(v);
const isChainId = (v) => /^\d+$/.test(v);
const nonEmpty = (v) => typeof v === "string" && v.trim().length > 0;

requireVar("deploy", "ARC_RPC_URL", isUrl);
requireVar("deploy", "ARC_CHAIN_ID", isChainId);
requireVar("deploy", "ARC_USDC_ADDRESS", isAddress);
requireVar("deploy", "ARC_USYC_ADDRESS", isAddress);
requireVar("deploy", "ARC_USYC_TELLER_ADDRESS", isAddress);
requireVar("deploy", "DEPLOYER_PRIVATE_KEY", isPrivateKey);
requireVar("deploy", "AGENT_ADDRESS", isAddress);

requireVar("contracts", "LEADER_ORACLE_ADDRESS", isAddress);
requireVar("contracts", "BOND_REGISTRY_ADDRESS", isAddress);
requireVar("contracts", "FOLLOWER_VAULT_ADDRESS", isAddress);

requireVar("agent", "AGENT_PRIVATE_KEY", isPrivateKey);
requireVar("agent", "HL_API_URL", isUrl);
requireVar("agent", "ANTHROPIC_API_KEY", nonEmpty);
requireVar("agent", "PINATA_JWT", nonEmpty);
requireVar("agent", "DATABASE_URL", nonEmpty);
requireVar("agent", "DIRECT_URL", nonEmpty);

requireVar("web", "NEXT_PUBLIC_ARC_RPC_URL", isUrl);
requireVar("web", "NEXT_PUBLIC_LEADER_ORACLE_ADDRESS", isAddress);
requireVar("web", "NEXT_PUBLIC_BOND_REGISTRY_ADDRESS", isAddress);
requireVar("web", "NEXT_PUBLIC_FOLLOWER_VAULT_ADDRESS", isAddress);
requireVar("web", "NEXT_PUBLIC_USDC_ADDRESS", isAddress);
requireVar("web", "NEXT_PUBLIC_USYC_ADDRESS", isAddress);
requireVar("web", "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", nonEmpty);
requireVar("web", "DATABASE_URL", nonEmpty);
requireVar("web", "DIRECT_URL", nonEmpty);

const active = checks.filter((c) => wants(c.phase));
const missing = [];
const invalid = [];

for (const check of active) {
  const value = env[check.key];
  if (!nonEmpty(value)) {
    missing.push(check.key);
  } else if (!check.validate(value)) {
    invalid.push(check.key);
  }
}

if (missing.length || invalid.length) {
  console.error("Vouch preflight failed.");
  if (missing.length) {
    console.error("\nMissing:");
    for (const key of missing) console.error(`  - ${key}`);
  }
  if (invalid.length) {
    console.error("\nInvalid format:");
    for (const key of invalid) console.error(`  - ${key}`);
  }
  console.error("\nNo mock fallback will be used. Fill real values and rerun preflight.");
  process.exit(1);
}

console.log(`Vouch preflight passed for: ${[...phases].join(", ")}`);
