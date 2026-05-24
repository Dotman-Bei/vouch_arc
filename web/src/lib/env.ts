// Centralized env access — fail loud at boot if a required public var is missing.
function pub(name: string): string {
  const v = process.env[`NEXT_PUBLIC_${name}`];
  if (!v) throw new Error(`Missing NEXT_PUBLIC_${name} in .env`);
  return v;
}
function pubOptional(name: string): string | undefined {
  return process.env[`NEXT_PUBLIC_${name}`] || undefined;
}
function srv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} in .env`);
  return v;
}
export const env = {
  arcRpcUrl: () => pub("ARC_RPC_URL"),
  oracleAddress: () => pub("LEADER_ORACLE_ADDRESS"),
  registryAddress: () => pub("BOND_REGISTRY_ADDRESS"),
  vaultAddress: () => pub("FOLLOWER_VAULT_ADDRESS"),
  usdcAddress: () => pub("USDC_ADDRESS"),
  usycAddress: () => pubOptional("USYC_ADDRESS"),

  // Server-only
  databaseUrl: () => srv("DATABASE_URL"),
};

export function contractsConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_LEADER_ORACLE_ADDRESS &&
    process.env.NEXT_PUBLIC_BOND_REGISTRY_ADDRESS &&
    process.env.NEXT_PUBLIC_FOLLOWER_VAULT_ADDRESS &&
    process.env.NEXT_PUBLIC_ARC_RPC_URL,
  );
}
