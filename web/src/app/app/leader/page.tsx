"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Contract, formatUnits, parseUnits } from "ethers";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useEthersSigner } from "@/lib/ethers-signer";
import { ERC20ABI, BondRegistryABI } from "@/lib/abis";

const USDC     = process.env.NEXT_PUBLIC_USDC_ADDRESS as string;
const REGISTRY = process.env.NEXT_PUBLIC_BOND_REGISTRY_ADDRESS as string;

export default function PostBondPage() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const signer               = useEthersSigner();
  const [amount, setAmount]     = useState("20");
  const [hlWallet, setHlWallet] = useState("");
  const [handle, setHandle]     = useState("");
  const [status, setStatus]     = useState("");
  const [busy, setBusy]         = useState(false);
  const [existingBond, setExistingBond] = useState<{
    amount: bigint;
    hlWallet: string;
    handle: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadExistingBond() {
      setExistingBond(null);
      if (!signer || !address) return;
      try {
        const registry = new Contract(REGISTRY, BondRegistryABI, signer);
        const bond = await registry.getBond(address);
        if (!cancelled && (bond.amount as bigint) > 0n) {
          setExistingBond({
            amount: bond.amount as bigint,
            hlWallet: bond.hlWallet as string,
            handle: bond.handle as string,
          });
        }
      } catch {
        if (!cancelled) setExistingBond(null);
      }
    }
    loadExistingBond();
    return () => { cancelled = true; };
  }, [address, signer]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      if (!signer) throw new Error("Wallet not ready — try reconnecting");
      const amt = parseUnits(amount || "0", 6);
      if (amt < parseUnits("20", 6))            throw new Error("Minimum bond is 20 USDC");
      if (!/^0x[a-fA-F0-9]{40}$/.test(hlWallet)) throw new Error("Enter a valid Hyperliquid address");
      if (!handle.trim())                       throw new Error("Enter a display handle");

      const me       = await signer.getAddress();
      const usdc     = new Contract(USDC, ERC20ABI, signer);
      const registry = new Contract(REGISTRY, BondRegistryABI, signer);

      const existing = await registry.getBond(me);
      if ((existing.amount as bigint) > 0n) {
        throw new Error("This wallet already has a leader bond. Use a different wallet or open your existing profile.");
      }

      const allowance: bigint = await usdc.allowance(me, REGISTRY);
      if (allowance < amt) {
        setStatus("Approve USDC in your wallet…");
        await (await usdc.approve(REGISTRY, amt)).wait();
      }
      setStatus("Confirm postBond in your wallet…");
      await (await registry.postBond(amt, hlWallet, handle)).wait();
      setStatus(`Bond of ${amount} USDC posted. You're live as ${handle}.`);
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="counter mb-2">become a leader</div>
      <h1 className="text-xl font-bold mb-3">Post a bond</h1>
      <p className="text-fg-secondary mb-10 max-w-prose">
        Your bond is your reputation, denominated in USDC. The Vouch agent will
        analyze your Hyperliquid history within minutes and publish your
        performance to the leaderboard. If your strategy degrades, the bond is slashed in
        graduated tiers to protect followers. You earn it back in full after
        30 days if never slashed.
      </p>

      {!isConnected ? (
        <div className="callout">
          <div className="label mb-2">wallet</div>
          <h3 className="text-md font-bold mb-2">Connect a wallet to post a bond.</h3>
          <p className="text-sm text-fg-secondary mb-4">
            Vouch runs on Arc testnet. Connect any EVM wallet — the network is
            added automatically.
          </p>
          <button className="btn-primary" onClick={openConnectModal}>connect wallet</button>
        </div>
      ) : existingBond ? (
        <div className="callout">
          <div className="label mb-2">leader already exists</div>
          <h3 className="text-md font-bold mb-2">{existingBond.handle || "This wallet"} already posted a bond.</h3>
          <p className="text-sm text-fg-secondary mb-4">
            This connected wallet has {formatUnits(existingBond.amount, 6)} USDC bonded to Hyperliquid wallet{" "}
            <span className="tabular">{existingBond.hlWallet.slice(0, 6)}...{existingBond.hlWallet.slice(-4)}</span>.
            A wallet can only create one leader profile.
          </p>
          {address && (
            <Link className="btn-primary no-underline" href={`/leader/${address}`}>
              open existing profile
            </Link>
          )}
        </div>
      ) : (
        <form className="card space-y-6" onSubmit={submit}>
          <div>
            <label className="label block mb-2">bond amount (USDC)</label>
            <input className="input tabular" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            <p className="text-xs text-fg-tertiary mt-2">Minimum 20 USDC. Locked 30 days.</p>
          </div>
          <div>
            <label className="label block mb-2">your Hyperliquid wallet</label>
            <input className="input tabular" placeholder="0x…" value={hlWallet} onChange={(e) => setHlWallet(e.target.value)} />
          </div>
          <div>
            <label className="label block mb-2">display handle</label>
            <input className="input" placeholder="@yourhandle" value={handle} onChange={(e) => setHandle(e.target.value)} />
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? "working…" : "post bond"}
          </button>
          {status && <p className="text-xs text-fg-secondary">{status}</p>}
          <p className="text-xs text-fg-tertiary">
            Two transactions — approve USDC, then postBond. Gas paid in USDC on
            Arc, the native gas token.
          </p>
        </form>
      )}
    </>
  );
}
