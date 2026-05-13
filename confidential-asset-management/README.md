# Confidential Asset Management DApp

A Midnight Network dApp where **investors allocate capital to fund managers without public exposure of allocations or strategy**. Funds get on-chain auditability of AUM and ROI; LPs stay anonymous; the GP's strategy stays off-chain and private.

📁 Source code in this folder.

📖 **DEV.to article:** https://dev.to/ayush_singh_4525768ba4731/-tutorial-confidential-asset-management-on-midnight-2hmb

📄 Local copy: [tutorial.md](./tutorial.md) · Tweet copy: [TWEET.md](./TWEET.md)

## Use case

Hedge funds, family offices, and crypto funds today face a binary choice:

- **TradFi rails**: real privacy, no programmability, slow settlement.
- **Public chains**: real-time settlement, zero privacy, every position visible.

Midnight gives you both. The on-chain ledger holds *only*:

- The GP's sealed public key
- A Merkle tree of LP commitments (no wallets, no names)
- Public AUM (so payouts can be solvency-checked)
- Public per-period ROI (so LPs can verify performance)

Everything else — who is in the fund, how much they allocated, what trades the GP is making — stays off-chain.

## Features

- **GP deploys** the fund and is sealed as the on-chain manager
- **GP admits LPs** by inserting commitments into a Merkle tree and bumping AUM
- **GP reports ROI** each period — public, immutable, verifiable
- **LPs prove membership** without revealing identity
- **LPs claim period payouts** via ZK proof + nullifier (no double-dipping)
- **GP can redeem LPs** to wind down or rebalance

## Pages

| Route | Description |
|-------|-------------|
| `/` | LP dashboard — generate commitments, view AUM/ROI |
| `/deploy` | GP launches the fund contract |
| `/admit` | GP admits an LP and bumps AUM |
| `/report` | GP publishes period ROI |
| `/payout` | LP proves membership or claims a period payout |

## Stack

- Compact 0.22 contracts (`HistoricMerkleTree<10, Bytes<32>>` + nullifier `Set`)
- React 19 + Vite 8 + TS + Tailwind v4
- `@midnight-ntwrk/dapp-connector-api` v4 (Lace, 1AM)
- Midnight Preprod indexer (GraphQL v4)

## Running

```bash
npm install
npx compact compile contracts/Contract.compact src/contracts/managed/fund
docker run -p 6300:6300 midnightntwrk/proof-server:8.0.3 midnight-proof-server -v
npm run dev
```

> The compile command writes the contract artefacts to `src/contracts/managed/fund/{contract,keys,zkir,compiler}`. The frontend imports the contract from this exact path.

## Wallets

- **Lace** — `https://www.lace.io/`
- **1AM** — `https://1am.xyz/`

Wallet on **Preprod**, funded with tNIGHT + tDUST.

## Contract

See [contracts/Contract.compact](./contracts/Contract.compact). Ledger fields:

- `manager: Bytes<32>` — sealed GP key
- `lpCommitments: HistoricMerkleTree<10, Bytes<32>>`
- `payoutNullifiers: Set<Bytes<32>>`
- `aum: Uint<64>` — public assets under management
- `reportedRoiBp: Uint<64>` — public ROI in basis points
- `totalLps`, `totalPayouts: Counter`

## Identity model

Same pattern as the other two dApps in this repo — `password + wallet.shieldedCoinPublicKey → PBKDF2 → secretKey`. Lose the password, lose the identity.
