"use client";

import { useState } from "react";
import { Contract, parseUnits } from "ethers";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useEthersSigner } from "@/lib/ethers-signer";
import { ERC20ABI, FollowerVaultABI } from "@/lib/abis";

const USDC  = process.env.NEXT_PUBLIC_USDC_ADDRESS as string;
const VAULT = process.env.NEXT_PUBLIC_FOLLOWER_VAULT_ADDRESS as string;

export function FollowButton({ leader, handle }: { leader: string; handle: string }) {
  const { isConnected }      = useAccount();
  const { openConnectModal } = useConnectModal();
  const signer               = useEthersSigner();
  const [amount, setAmount]  = useState("50");
  const [open, setOpen]      = useState(false);
  const [status, setStatus]  = useState("");
  const [busy, setBusy]      = useState(false);

  async function go() {
    setBusy(true);
    setStatus("");
    try {
      if (!signer) throw new Error("Wallet not ready — try reconnecting");
      const amt = parseUnits(amount || "0", 6);
      if (amt < parseUnits("10", 6)) throw new Error("Minimum 10 USDC");

      const me    = await signer.getAddress();
      const usdc  = new Contract(USDC, ERC20ABI, signer);
      const vault = new Contract(VAULT, FollowerVaultABI, signer);

      const allowance: bigint = await usdc.allowance(me, VAULT);
      if (allowance < amt) {
        setStatus("Approve USDC in your wallet…");
        await (await usdc.approve(VAULT, amt)).wait();
      }
      setStatus("Confirm the deposit in your wallet…");
      await (await vault.deposit(leader, amt)).wait();
      setStatus(`Deposited ${amount} USDC to ${handle}.`);
      setTimeout(() => location.reload(), 1500);
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "failed");
    } finally {
      setBusy(false);
    }
  }

  if (!isConnected) {
    return (
      <button className="btn-primary w-full" onClick={openConnectModal}>
        connect wallet to follow
      </button>
    );
  }

  if (!open) {
    return (
      <button className="btn-primary w-full" onClick={() => setOpen(true)}>
        follow this leader
      </button>
    );
  }

  return (
    <div className="card">
      <div className="label mb-2">deposit amount (USDC)</div>
      <input
        className="input tabular mb-3"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        inputMode="decimal"
      />
      <p className="text-xs text-fg-tertiary mb-4">
        Minimum 10 USDC. Synthetic exposure to {handle} via the Vouch
        returnIndex — slash proceeds make you whole before principal is
        touched. Withdrawable anytime.
      </p>
      <div className="flex gap-3">
        <button className="btn-primary flex-1" disabled={busy} onClick={go}>
          {busy ? "working…" : `deposit ${amount} USDC`}
        </button>
        <button className="btn-ghost" disabled={busy} onClick={() => setOpen(false)}>cancel</button>
      </div>
      {status && <p className="text-xs text-fg-secondary mt-3">{status}</p>}
    </div>
  );
}
