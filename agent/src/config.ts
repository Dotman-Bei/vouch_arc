import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  ARC_RPC_URL: z.string().url(),
  AGENT_PRIVATE_KEY: z.string().min(32),
  HL_API_URL: z.string().url().default("https://api.hyperliquid.xyz/info"),
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-6"),
  PINATA_JWT: z.string().min(1),
  DATABASE_URL: z.string().optional(),
  DISCORD_WEBHOOK_URL: z.string().optional(),
  AGENT_CRON: z.string().default("*/5 * * * *"),
  AGENT_MIN_ANALYSIS_INTERVAL_MINUTES: z.coerce.number().int().min(1).default(60),
  LEADER_ORACLE_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  BOND_REGISTRY_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  FOLLOWER_VAULT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  DEGRADATION_SLASH_THRESHOLD: z.coerce.number().default(50),
  MAX_SLASH_BPS: z.coerce.number().default(8000),
});

export const config = schema.parse(process.env);
