# Confidential Real Estate DApp

A Midnight Network dApp for **tokenized property shares with private ownership and rental-yield data**. Investors stay anonymous while regulators receive auditable ZK proofs of ownership and compliance.

📁 Full source code is here.

📖 **DEV.to article:** https://dev.to/ayush_singh_4525768ba4731/-tutorial-building-confidential-tokenized-real-estate-on-midnight-26o9

📄 Local copy: [tutorial.md](./tutorial.md) · Tweet copy: [TWEET.md](./TWEET.md)

## Use case

Family offices, REIT issuers, and individual investors all want different things:

- Investors want anonymity (no public link from wallet → property)
- Issuers want to airdrop rental yield without revealing the holder list
- Regulators want a verifiable trail of ownership and compliance

Midnight balances all three. The on-chain ledger only stores **commitments** in a Merkle tree, never wallet identities or holdings. Investors prove ownership and claim yield with zero-knowledge proofs; nullifiers prevent double-claims per (property, cycle).

## Features

- **Sponsor deploys** the property contract; their public key is sealed on-chain
- **Issuer attests** an investor by inserting an ownership commitment into the Merkle tree
- **Investors prove ownership** with `proveOwnership(propertyId)` — emits only a boolean
- **Investors claim rental yield** with `claimYield(propertyId, cycle, amount)` — nullifier prevents double-claim
- **Aggregate stats** are public: `totalProperties`, `totalShares`, `totalYieldClaims`, `rentalPoolAvailable`

## Tech stack

- React 19 + Vite 8 + TypeScript + Tailwind v4
- `@midnight-ntwrk/dapp-connector-api` v4 (Lace, 1AM)
- Compact 0.22 contracts with `HistoricMerkleTree<10, Bytes<32>>` + nullifier sets
- Midnight Preprod indexer (GraphQL v4) + WebSocket subscriptions

## Pages

| Route | Description |
|-------|-------------|
| `/` | Investor dashboard — generate ownership commitments |
| `/deploy` | Sponsor deploys a new property contract |
| `/issue` | Sponsor inserts a holder commitment into the Merkle tree |
| `/claim` | Investor proves ownership or claims a rental cycle |

## Running locally

```bash
npm install
npx compact compile contracts/Contract.compact src/contracts/managed/realestate
docker run -p 6300:6300 midnightntwrk/proof-server:8.0.3 midnight-proof-server -v
npm run dev
```

> The compile command writes the contract artefacts to `src/contracts/managed/realestate/{contract,keys,zkir,compiler}`. The frontend imports the contract from this exact path.

The frontend runs on `http://localhost:5173`. Make sure the Lace or 1AM extension is installed and the wallet is on **Preprod**.

## Wallets

- **Lace** — `https://www.lace.io/`
- **1AM** — `https://1am.xyz/`

Fund the wallet with tNIGHT + tDUST from the Midnight Preprod faucet before deploying.

## Contract

See [contracts/Contract.compact](./contracts/Contract.compact). Ledger fields:

- `sponsor: Bytes<32>` — sealed public key of property sponsor
- `ownershipCommitments: HistoricMerkleTree<10, Bytes<32>>` — investor commitments
- `yieldClaimNullifiers: Set<Bytes<32>>` — used per (property, cycle, investor)
- `totalProperties`, `totalShares`, `totalYieldClaims: Counter`
- `rentalPoolAvailable: Uint<64>` — pool sponsors deposit into

## Identity model

Identical to the fullstack-dapp reference: your **password + wallet shielded key** deterministically derives your secret key. Lose your password → lose your identity. Nothing is stored remotely.
