# Confidential Dividend DApp

A Midnight Network dApp for **private dividend distribution**: corporate issuers pay dividends on-chain while shareholder identities stay hidden. Auditors can still verify in zero-knowledge that every payout went to a legitimate holder and that no double-claims occurred.

📁 Full source code in this folder. Article: [tutorial.md](./tutorial.md). Tweet: [TWEET.md](./TWEET.md).

## Use case

Public companies face a privacy paradox: cap-table data is sensitive (M&A signals, insider holdings, family-office positions) but dividend payouts must be auditable. Today the only solutions are (1) trusted custodians or (2) full public disclosure.

Midnight breaks the trade-off. The on-chain ledger:

- Stores only commitments — never wallet addresses or names
- Lets shareholders prove eligibility with ZK proofs
- Uses nullifiers to enforce "one claim per cycle per shareholder"
- Publishes aggregate counters (total holders, total payouts) for auditors

## Features

- **Issuer deploys** the dividend contract; sealed authority public key
- **Issuer registers shareholders** by inserting commitments into a Merkle tree
- **Issuer tops up the pool** and declares per-share dividend rate each cycle
- **Shareholders claim dividends** with ZK proof + nullifier
- **Shareholders prove eligibility** (without claiming) for KYC/onboarding flows

## Pages

| Route | Description |
|-------|-------------|
| `/` | Shareholder dashboard — generate commitments, view stats |
| `/deploy` | Issuer deploys the dividend contract |
| `/register` | Issuer registers a shareholder commitment |
| `/declare` | Issuer tops up pool + declares the per-share rate |
| `/claim` | Shareholder proves eligibility or claims the cycle dividend |

## Stack

- Compact 0.22 contracts (`HistoricMerkleTree<10, Bytes<32>>` + nullifier `Set`)
- React 19 + Vite 8 + TS + Tailwind v4
- `@midnight-ntwrk/dapp-connector-api` v4 (Lace, 1AM)
- Midnight Preprod indexer (GraphQL v4)

## Running

```bash
npm install
npx compact compile contracts/Contract.compact src/contracts/managed/dividend
docker run -p 6300:6300 midnightntwrk/proof-server:8.0.3 midnight-proof-server -v
npm run dev
```

> The compile command writes the contract artefacts to `src/contracts/managed/dividend/{contract,keys,zkir,compiler}`. The frontend imports the contract from this exact path.

## Wallets

- **Lace** — `https://www.lace.io/`
- **1AM** — `https://1am.xyz/`

Make sure the wallet is on **Preprod** and funded with tNIGHT + tDUST.

## Contract

See [contracts/Contract.compact](./contracts/Contract.compact). Ledger fields:

- `issuer: Bytes<32>` — sealed public key
- `shareholderCommitments: HistoricMerkleTree<10, Bytes<32>>`
- `dividendNullifiers: Set<Bytes<32>>`
- `dividendPool: Uint<64>`
- `declaredDividend: Uint<64>`
- `totalShareholders`, `totalDividendsPaid: Counter`

## Identity model

`password + wallet.shieldedCoinPublicKey → SHA-256 → secretKey`. Same wallet + same password = same identity forever. Lose your password → lose your identity (by design — nothing is stored remotely).
