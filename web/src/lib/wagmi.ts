import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import { http } from "wagmi";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!walletConnectProjectId) {
  console.warn("Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID. Browser extension wallets can still work, but WalletConnect/Reown QR wallets need a real project ID from https://cloud.reown.com.");
}

// Arc testnet — Circle's L1. USDC is the native gas token; the protocol
// denominates the native balance with 18 decimals.
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc.network"],
    },
  },
  testnet: true,
});

// RainbowKit/wagmi config. The wallet picker lists every EIP-1193 wallet that
// supports custom EVM chains — MetaMask, Rabby, Coinbase, etc. — all of which
// work with Arc once the network is added. A WalletConnect Project ID is only
// needed for QR-code / mobile wallets; browser-extension wallets work without.
export const wagmiConfig = getDefaultConfig({
  appName: "Vouch",
  projectId: walletConnectProjectId || "vouch-arc-demo",
  chains: [arcTestnet],
  transports: { [arcTestnet.id]: http() },
  ssr: true,
});
