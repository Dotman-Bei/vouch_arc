"use client";

import { useCallback, useEffect, useState } from "react";
import { Contract } from "ethers";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useEthersSigner } from "@/lib/ethers-signer";
import { FollowerVaultABI } from "@/lib/abis";
import { fmtUsdc } from "@/lib/format";

const VAULT = process.env.NEXT_PUBLIC_FOLLOWER_VAULT_ADDRESS as string;

interface Position {
  leader: string;
  handle: string;
  shares: string;
  value: number;
}

export default function DashboardPage() {
  const { address, isConnected }  = useAccount();
  const { openConnectModal }      = useConnectModal();
  const signer                    = useEthersSigner();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading]     = useState(false);
  const [status, setStatus]       = useState("");

  const refresh = useCallback(async () => {
    if (!address) { setPositions([]); return; }
    setLoading(true);
    try {
      const r = await fetch(`/api/follower/positions?address=${address}`);
      if (r.ok) {
        const d = await r.json();
        setPositions(d.positions ?? []);
      }
    } finally { setLoading(false); }
  }, [address]);

  useEffect(() => { refresh(); }, [refresh]);

  async function withdraw(p: Position) {
    setStatus(`Withdrawing from ${p.handle}…`);
    try {
      if (!signer) throw new Error("Wallet not ready — try reconnecting");
      const vault = new Contract(VAULT, FollowerVaultABI, signer);
      setStatus("Confirm the withdrawal in your wallet…");
      await (await vault.withdraw(p.leader, BigInt(p.shares))).wait();
      setStatus(`Withdrew from ${p.handle}.`);
      refresh();
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "failed");
    }
  }

  const totalValue = positions.reduce((a, p) => a + p.value, 0);

  return (
    <>
      <div className="counter mb-2">app</div>
      <h1 className="text-xl font-bold mb-8">Your positions</h1>

      {!isConnected || !address ? (
        <section className="min-h-[320px]">
          <div className="callout">
            <div className="label mb-2">wallet</div>
            <h3 className="text-md font-bold mb-2">Connect a wallet to see your positions.</h3>
            <p className="text-sm text-fg-secondary mb-4">
              Vouch runs on Arc testnet. Connect any EVM wallet — the network is
              added automatically.
            </p>
            <button className="btn-primary" onClick={openConnectModal}>connect wallet</button>
            <p className="text-xs text-fg-tertiary mt-4">
              All gas paid in USDC — Arc's native gas token. No ETH, no bridging.
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            <Stat label="current value" value={`${fmtUsdc(totalValue, 2)} USDC`} />
            <Stat label="positions"     value={String(positions.length)} />
            <Stat label="protection"    value="bond-first" tone="good" />
            <Stat label="wallet"        value={`${address.slice(0, 6)}…${address.slice(-4)}`} />
          </section>

          {loading ? (
            <div className="text-fg-secondary text-sm">loading positions…</div>
          ) : positions.length === 0 ? (
            <div className="callout">
              <div className="label mb-2">empty</div>
              <h3 className="text-md font-bold mb-2">No positions yet.</h3>
              <p className="text-sm text-fg-secondary mb-4">
                Pick a leader from the leaderboard and click "follow this leader"
                to deposit USDC. Slash proceeds make you whole before your
                principal is ever touched.
              </p>
              <a className="btn-primary no-underline" href="/leaderboard">explore leaders</a>
            </div>
          ) : (
            <section className="card overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.10em] text-fg-secondary">
                    <th className="p-4">leader</th>
                    <th className="p-4 text-right">value</th>
                    <th className="p-4 text-right">actions</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.leader} className="border-t border-line">
                      <td className="whitespace-nowrap p-4">{p.handle}</td>
                      <td className="whitespace-nowrap p-4 text-right tabular">{fmtUsdc(p.value, 2)} USDC</td>
                      <td className="p-4 text-right">
                        <button className="btn-ghost text-xs px-3 py-1" onClick={() => withdraw(p)}>withdraw</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {status && <p className="text-xs text-fg-secondary mt-4">{status}</p>}
        </>
      )}

    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" }) {
  const color = tone === "good" ? "text-status-good" : "";
  return (
    <div className="card">
      <div className="label mb-2">{label}</div>
      <div className={`text-md font-bold tabular ${color}`}>{value}</div>
    </div>
  );
}
