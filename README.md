<div align="center">

# VOUCH

**Bond-backed copy trading on Arc — where the leader bleeds first.**

*Every leader posts a USDC bond. An AI agent scores new leaders within minutes and re-audits them on a monitoring interval. When a strategy degrades, the bond slashes — not your deposit.*

[![License: MIT](https://img.shields.io/badge/license-MIT-white?style=flat-square)](./LICENSE)
[![Built for Agora Agents 2026](https://img.shields.io/badge/built%20for-Agora%20Agents%202026-c8e665?style=flat-square)](https://thecanteenapp.com)
[![Settles on Arc](https://img.shields.io/badge/settles%20on-Arc-blue?style=flat-square)](https://docs.arc.network)
[![Value flow: USDC](https://img.shields.io/badge/value%20flow-USDC-2775ca?style=flat-square)](https://developers.circle.com)
[![Reasoning: Claude](https://img.shields.io/badge/reasoning-Claude-d97757?style=flat-square)](https://www.anthropic.com)
[![Audited data: Hyperliquid](https://img.shields.io/badge/audited%20data-Hyperliquid-97fce4?style=flat-square)](https://hyperliquid.xyz)

</div>

---

## The pitch in one paragraph

Every copy-trading platform today puts **100% of the downside on the follower** — you mirror a leader's trades, and when their strategy quietly decays, your principal is what bleeds. Vouch inverts that. On Vouch, every leader must post a **USDC performance bond** before they can attract a single follower. An autonomous agent checks for newly bonded leaders every few minutes, reads their Hyperliquid trade history, computes risk-adjusted metrics, writes a structured reasoning trace (keccak-hashed on-chain, pinned to IPFS), and triggers **graduated bond slashes** the moment performance degrades. Followers gain synthetic exposure to the leader's verified PnL; the slashed bond tops up the follower return index and makes them whole **before their principal is ever touched**. The leader bleeds first.

```solidity
// Within minutes of a new bond, the Vouch agent commits its verdict on-chain:
FollowerVault.updateReturnIndex(leader, returnBps);   // mirror the leader's verified PnL
BondRegistry.slash(leader, slashBps, reasonHash);     // leader's bond → FollowerVault
//  ↑ slashed USDC tops up the follower return index — followers are made
//    whole before their principal is ever touched.
```

---

## Why this matters

| Without Vouch                                          | With Vouch                                                       |
|--------------------------------------------------------|------------------------------------------------------------------|
| 100% of copy-trade downside sits with the follower     | The leader's **USDC bond absorbs losses first**                  |
| Leaders ranked by raw PnL and vanity metrics           | Ranked by a composite **degradation score**, scored quickly and re-audited on a monitoring interval |
| "Trust me" — no accountability for strategy decay      | A **graduated bond slash** fires the moment performance degrades |
| Copy-trading is an opaque black box                    | Every verdict ships an **IPFS-pinned reasoning trace**, hash on-chain |
| Your principal is at risk from day one                 | Principal is **untouched until the leader's bond is fully drained** |

---

## Stack

| Layer            | Component                                                                                   |
|------------------|---------------------------------------------------------------------------------------------|
| **Settlement**   | [Arc Testnet](https://docs.arc.network) — Circle's L1; gas paid in USDC, no ETH, no bridging |
| **Value flow**   | [USDC](https://developers.circle.com) — every flow: bonds, deposits, slashes                 |
| **Audited data** | [Hyperliquid](https://hyperliquid.xyz) — the public trade history the agent audits           |
| **Reasoning**    | [Claude](https://www.anthropic.com) — the agent's structured reasoning traces                |
| **Trace storage**| IPFS via [Pinata](https://pinata.cloud) — traces pinned off-chain, keccak hash committed on-chain |
| **Wallets**      | [RainbowKit](https://rainbowkit.com) / [wagmi](https://wagmi.sh) — MetaMask, Rabby, any EVM wallet |

---

## How it works — "Mirror with Insurance"

1. **Bond** — a leader posts a USDC bond to `BondRegistry`. No bond, no followers.
2. **Deposit** — a follower deposits USDC to `FollowerVault`, gaining synthetic exposure to the leader's PnL.
3. **Audit** — newly bonded leaders are scored within minutes; existing scored leaders are re-audited on a monitoring interval.
4. **Mirror** — `FollowerVault.updateReturnIndex(leader, returnBps)` moves follower share values synthetically.
5. **Slash** — if the degradation score crosses threshold, the agent calls `BondRegistry.slash(leader, slashBps, reasonHash)`. The slash sends USDC from the leader's bond into `FollowerVault`, bumping the return index — followers are made whole **before** their principal is ever touched.

Followers cannot lose principal until the leader's bond is fully drained. The leader bleeds first.

---

## Architecture

```
   ┌────────────────────┐                      ┌────────────────────┐
   │  Leader            │                      │  Follower          │
   │  posts a USDC bond │                      │  deposits USDC     │
   └─────────┬──────────┘                      └─────────┬──────────┘
             │ postBond()                                │ deposit()
             ▼                                           ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │                  Arc Testnet — Circle's L1                        │
   │                  gas paid in USDC · no ETH · no bridging          │
   │                                                                   │
   │   ┌───────────────┐    ┌───────────────┐    ┌──────────────────┐  │
   │   │ BondRegistry  │    │ LeaderOracle  │    │ FollowerVault    │  │
   │   │ holds bonds   │    │ verified      │    │ holds deposits   │  │
   │   │ slash()       │    │ returnBps     │    │ returnIndex      │  │
   │   └───────▲───────┘    └───────▲───────┘    └────────▲─────────┘  │
   └───────────┼────────────────────┼──────────────────────┼──────────┘
               │ slash()            │ writes returnBps     │ updateReturnIndex()
               │                    │                      │
               └────────────────────┴───────────┬──────────┘
                                                 │
                       ┌─────────────────────────┴────────────────────────┐
                       │            Vouch Agent — fast onboarding cron      │
                       │                                                   │
                       │   1  read each leader's Hyperliquid history       │
                       │   2  compute risk-adjusted metrics                │
                       │   3  Claude → structured reasoning trace          │
                       │   4  pin trace to IPFS, commit keccak hash        │
                       │   5  slash degraded leaders on-chain              │
                       └──────────┬─────────────────────────┬──────────────┘
                                  │                         │
                                  ▼                         ▼
                      ┌────────────────────┐   ┌─────────────────────────┐
                      │  Hyperliquid       │   │  IPFS (Pinata)          │
                      │  public trade data │   │  reasoning traces       │
                      └────────────────────┘   └─────────────────────────┘

   ┌──────────────────────────────────────────────────────────────────┐
   │   web/ — Next.js 14                                               │
   │   leaderboard · leader profiles · follower dashboard · /agent     │
   │   reads contracts + agent DB → renders verdicts, traces, charts   │
   └──────────────────────────────────────────────────────────────────┘
```

---

## Repository layout

```
vouch/
├── README.md                   ← you are here
│
├── contracts/                  ← Hardhat — Solidity, deployed to Arc Testnet
│   ├── src/
│   │   ├── BondRegistry.sol    ← leader bonds + graduated slashing
│   │   ├── FollowerVault.sol   ← follower deposits + per-leader return index
│   │   ├── LeaderOracle.sol    ← verified returnBps feed
│   │   └── mocks/MockUSDC.sol  ← local-test USDC
│   ├── scripts/                ← deploy / redeploy / seed
│   └── test/Vouch.test.ts      ← end-to-end contract tests
│
├── agent/                      ← Node 20 + TypeScript — the autonomous agent
│   ├── prisma/                 ← owns the DB schema + migrations
│   └── src/
│       ├── hyperliquid.ts      ← pulls public trade history
│       ├── analyzer.ts         ← risk-adjusted metrics + degradation score
│       ├── reasoner.ts         ← Claude → structured reasoning trace
│       ├── dispatcher.ts       ← on-chain slash + IPFS pinning
│       └── index.ts            ← agent cron entrypoint
│
└── web/                        ← Next.js 14 — the public app
    └── src/
        ├── app/                ← leaderboard, profiles, dashboard, /agent
        ├── components/         ← UI components
        └── lib/                ← chain, wagmi, prisma, formatting
```

---

## Contracts (Arc Testnet)

| Contract        | Address                                        |
|-----------------|------------------------------------------------|
| `LeaderOracle`  | `0x483c978F4194f073828aA9EAbaf64630Ab2A424a`   |
| `BondRegistry`  | `0x3A4Cd51e205d7406eCa682827BED821A94c2f164`   |
| `FollowerVault` | `0x94ED02Bf813f9780f72F3e7d209e8173F5A49234`   |

---

## Quickstart

### Prerequisites

Node 20+, pnpm 9, a Postgres database, and a populated `.env`:

```bash
pnpm install
cp .env.example .env          # fill in keys
```

### 1 · Contracts

```bash
pnpm contracts:build
pnpm contracts:test
pnpm contracts:deploy         # writes addresses to deployments.local.json
```

> ⚠ After deploy, paste the three addresses from `deployments.local.json` into `.env` as the `NEXT_PUBLIC_*_ADDRESS` variables before running the agent or the web app.

### 2 · Database

```bash
pnpm db:migrate               # local dev — runs against DATABASE_URL
# (or on a fresh prod DB:  pnpm db:deploy)
pnpm db:generate              # generates Prisma clients for both workspaces
```

### 3 · Run

```bash
pnpm agent:run                # one-shot cycle — useful for the first push
pnpm agent:dev                # cron + immediate run (long-running)
pnpm web:dev                  # → localhost:3000
```

### 4 · Verify live wiring

```bash
pnpm status:live              # read-only Arc + DB status report
pnpm web:build                # production build; tolerates Windows Prisma file locks if a client already exists
```

`status:live` is intentionally read-only. It checks deployed bytecode, registry/oracle/vault wiring, bonded leaders, USYC teller mode, and database reachability.

---

## What The Agent Decides

1. **Degradation** — which leaders have decayed, and by how much (composite score `0–100`).
2. **Slash size** — a graduated `slashBps` (`0–8000`) calibrated to severity.
3. **Reasoning trace** — a structured Claude trace, IPFS-pinned, keccak hash committed on-chain.
4. **Verdict** — a public call: `follow` / `watch` / `avoid`.

Every decision is a signed on-chain transaction backed by real USDC at risk. Run history is on the `/agent` page.

---

## Database model

The `agent/` workspace **owns the schema and migrations**. The `web/` workspace keeps a byte-identical mirror used only for `prisma generate` — its `prisma:sync` script copies the agent's schema before each generate, so the two never drift. Never run `prisma migrate` from `web/`.

| Workspace  | Role                       | Commands                                |
|------------|----------------------------|-----------------------------------------|
| `agent/`   | Writes · owns migrations   | `pnpm db:migrate`, `pnpm db:deploy`     |
| `web/`     | Reads · mirrors schema     | `pnpm --filter web prisma:generate`     |

---

## Trust model

| Version       | Model                                                                          |
|---------------|--------------------------------------------------------------------------------|
| **v1** (now)  | Single trusted agent EOA — every decision on-chain, every trace IPFS-hashed     |
| **v2**        | Multi-sig oracle — 2-of-3 agents                                               |
| **v3**        | ZK-proven metric computation — trustless                                       |

---

## Roadmap

| Milestone               | Detail                                                                                                    |
|-------------------------|-----------------------------------------------------------------------------------------------------------|
| **USYC base yield**     | Idle follower USDC earns yield via USYC — the integration lives in `FollowerVault`, gated off because Arc testnet's USYC teller is permissioned |
| **Cross-chain deposits**| Follower USDC arrives from any chain via Circle CCTP                                                       |
| **V1.1 — live execution** | Follower USDC routes to the leader's Hyperliquid sub-account; trades execute live; the bond covers underperformance; leaders earn a 20% performance fee |

Fresh deploys keep the USYC teller disabled by default (`ARC_ENABLE_USYC_TELLER=false`) so follower deposits do not revert on the permissioned Arc testnet teller. Set `ARC_ENABLE_USYC_TELLER=true` only after the vault is allowlisted.

---

## Hackathon context

Built for the [Agora Agents Hackathon](https://thecanteenapp.com) — Canteen × Circle × Arc — RFB 06, *Social Trading Intelligence*.

| Dimension (weight)             | Vouch's claim                                                                                  |
|--------------------------------|------------------------------------------------------------------------------------------------|
| **Agentic sophistication 30%** | Autonomous loop: fast onboarding scan → Claude reasoning trace → graduated on-chain slash  |
| **Traction 30%**               | A live leaderboard and agent on Arc testnet — leaders bond, followers deposit, slashes settle   |
| **Circle tool usage 20%**      | USDC for every value flow · Arc settlement with gas in USDC · USYC + CCTP on the roadmap        |
| **Innovation 20%**             | Bond-backed copy trading — IPFS-pinned, hash-committed reasoning makes "the leader bleeds first" verifiable |

---

## Status

| Component                     | State                                                          |
|-------------------------------|----------------------------------------------------------------|
| Contracts                     | All three deployed on Arc Testnet (see table above)            |
| Vouch agent                   | Live — fast onboarding cycle: analyze → reason → slash         |
| Web app                       | Live — leaderboard · profiles · dashboard · `/agent` feed      |
| Reasoning traces              | IPFS-pinned via Pinata · keccak hash committed on-chain        |
| USYC base yield               | Built into `FollowerVault` · gated off (permissioned testnet teller) |
| Cross-chain deposits (CCTP)   | Roadmap — V1.1                                                 |
| Trust model                   | v1 — single agent EOA                                          |

---

## Credits

Built on [Arc](https://docs.arc.network) and [Circle](https://developers.circle.com), reasoned by [Claude](https://www.anthropic.com), audited against [Hyperliquid](https://hyperliquid.xyz).
Submitted to the Agora Agents Hackathon · Canteen × Circle × Arc · 2026.

Pull-quote: *"Those who don't take risks should never be involved in making decisions."* — Nassim Nicholas Taleb, *Skin in the Game*

---

## License

MIT.
