# Midnight dApps

> Three privacy-preserving DApps on the [Midnight Network](https://midnight.network/) showing how zero-knowledge proofs unlock real-world finance use cases that public chains have never been able to serve.

Each dApp is fully independent: its own Compact smart contract, its own React frontend, its own DEV.to tutorial. They share the same Midnight primitives (commitment scheme + Merkle tree + nullifier set + deterministic wallet identity) so once you learn one, you can read the other two in minutes.

---

## The three projects

| dApp | What it does | Why it needs Midnight | Color |
|------|--------------|-----------------------|-------|
| **[confidential-real-estate](./confidential-real-estate)** | Tokenized property shares with private ownership and rental-yield claims | Family offices want anonymity on the cap table; regulators still get auditable proofs of ownership | 🟢 emerald |
| **[confidential-dividend](./confidential-dividend)** | Corporate dividend payouts that hide the shareholder list | Public chains leak insider holdings in real time. Midnight publishes payouts while keeping recipients private | 🟣 violet |
| **[confidential-asset-management](./confidential-asset-management)** | Fund-manager / LP infrastructure with private allocations + public ROI | LPs stay anonymous; AUM and ROI are publicly verifiable; strategy stays off-chain | 🟡 amber |

Every dApp ships with:

- A working **Compact 0.22** smart contract (`contracts/Contract.compact`)
- A **React 19 + Vite 8 + Tailwind v4** frontend with role-specific pages
- **Lace** and **1AM** wallet support via `@midnight-ntwrk/dapp-connector-api` v4
- A polished **landing-page mockup** so screenshots look like a live app before you even open the wallet
- A **DEV.to-ready tutorial** (`tutorial.md`) and tweet copy (`TWEET.md`)

---

## What's inside each project

```
confidential-<name>/
├── contracts/
│   └── Contract.compact         # the on-chain logic
├── src/
│   ├── App.tsx                  # router + auto-reconnect
│   ├── pages/                   # Home + role-specific pages
│   │   ├── Home.tsx             # dashboard, commitment builder
│   │   ├── Deploy.tsx           # authority deploys the contract
│   │   └── ...                  # Issue / Register / Admit / Declare / Claim …
│   ├── hooks/
│   │   ├── useWallet.ts         # Zustand store for wallet state
│   │   ├── useIdentity.ts       # wallet → role secret key
│   │   └── wallet/              # constants + types
│   ├── components/
│   │   ├── layout/Layout.tsx
│   │   ├── RequireWallet.tsx    # route guard
│   │   ├── LandingPreview.tsx   # mock dashboard for the unconnected state
│   │   └── ui/                  # Button, Modal, ConnectButton, StatusPanel, …
│   └── lib/
│       ├── midnight.ts          # provider-bundle helper
│       └── utils.ts             # crypto helpers
├── README.md                    # how to run this dApp
├── tutorial.md                  # DEV.to-ready article
├── TWEET.md                     # tweet copy
└── package.json
```

The contracts in all three dApps use the same building blocks:

```compact
export sealed ledger authority: Bytes<32>;                       // sealed at deploy
export ledger commitments: HistoricMerkleTree<10, Bytes<32>>;    // private members
export ledger nullifiers: Set<Bytes<32>>;                        // anti-replay

witness localSecretKey(): Bytes<32>;
witness findPath(commit: Bytes<32>): MerkleTreePath<10, Bytes<32>>;
```

Read the three contracts side-by-side and you'll see the privacy model click: an authority writes leaves into the tree; a member proves inclusion in zero knowledge; a nullifier blocks replays.

---

## Quick start

Pick any dApp folder, then:

```bash
cd confidential-real-estate                                          # or dividend / asset-management
npm install
npx compact compile contracts/Contract.compact src/contracts/managed/realestate
docker run -p 6300:6300 midnightntwrk/proof-server:8.0.3 midnight-proof-server -v
npm run dev
```

> Compile commands per project:
> - real-estate → `npx compact compile contracts/Contract.compact src/contracts/managed/realestate`
> - dividend → `npx compact compile contracts/Contract.compact src/contracts/managed/dividend`
> - asset-management → `npx compact compile contracts/Contract.compact src/contracts/managed/fund`

The dev server runs at `http://localhost:5173`. Open it in a browser with **Lace** or **1AM** installed and switched to **Preprod**.

---

## Wallets

| Wallet | Install | Notes |
|--------|---------|-------|
| **Lace** | https://www.lace.io/ | Cardano wallet by IOHK; the most-tested option |
| **1AM** | https://1am.xyz/ | Midnight-first wallet |

After installing, switch the wallet to **Preprod** and fund it with tNIGHT + tDUST from the Midnight faucet before deploying anything.

---

## Privacy model in one paragraph

`wallet.shieldedCoinPublicKey → PBKDF2(SHA-256, 100k) → masterKey → SHA-256(masterKey ‖ role) → roleSecretKey`. Same wallet always yields the same role secret key — no extra password ceremony in the UI, no remote storage, no escrow. Lose your wallet seed phrase and the identity is gone, like any wallet. The role secret key is then hashed with a domain separator and a scope ID (property, share-class, fund) to produce the *commitment* the authority inserts into the Merkle tree.

---

## Tech stack

| | |
|---|---|
| Smart contracts | Compact 0.22 + CompactStandardLibrary |
| Compiler | `@midnight-ntwrk/compact-js` 2.5.0 |
| Runtime | `@midnight-ntwrk/compact-runtime` 0.15.0 |
| Ledger | `@midnight-ntwrk/ledger-v8` 8.0.3 |
| Midnight.js | 4.0.4 |
| DApp Connector | `@midnight-ntwrk/dapp-connector-api` 4.0.1 |
| Frontend | React 19 + Vite 8 + TypeScript |
| Styling | Tailwind CSS v4 (dark, finance-grade) |
| State | Zustand 5 |
| Routing | React Router 7 |
| Indexer | `https://indexer.preprod.midnight.network/api/v4/graphql` |
| Proof server | `midnightntwrk/proof-server:8.0.3` (local, port 6300) |

---

## How the three differ

The three dApps share a privacy primitive but their **economic semantics** differ — the privacy/auditability trade-off is tuned differently in each:

- **Real estate** — investors fully anonymous, rental pool public.
- **Dividend** — shareholders anonymous, declared rate and total payouts public.
- **Asset management** — LPs anonymous, but AUM and ROI are public so the GP can credibly prove performance.

That tuning happens at the contract level via which arguments are passed through `disclose(...)`. Reading the three contracts back-to-back is the fastest way to learn the trade-offs.

The UIs also intentionally look different so screenshots and demos are distinct:

- **Real-estate** UI: property-gallery layout with selectable cards (London / NYC / Singapore mock listings).
- **Dividend** UI: corporate ticker style with declared-cycle rows and share-class chips.
- **Asset-management** UI: fund-admin terminal with a giant AUM number, ROI bar chart, and fund picker.

---

## Articles + tweets

Each project ships a long-form DEV.to tutorial and tweet copy you can drop into a thread:

| dApp | Tutorial | Tweet |
|------|----------|-------|
| Real estate | [tutorial.md](./confidential-real-estate/tutorial.md) | [TWEET.md](./confidential-real-estate/TWEET.md) |
| Dividend | [tutorial.md](./confidential-dividend/tutorial.md) | [TWEET.md](./confidential-dividend/TWEET.md) |
| Asset management | [tutorial.md](./confidential-asset-management/tutorial.md) | [TWEET.md](./confidential-asset-management/TWEET.md) |

The tutorials read independently — each opens with a different real-world problem statement, walks through its own Compact contract, and ends with troubleshooting specific to its domain.

---

## Documentation

| File | What's in it |
|------|--------------|
| [README.md](./README.md) | this file |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | how to add a new dApp, what's accepted, what isn't |
| [Methodology.md](./Methodology.md) | scope, who wrote what (human vs AI), privacy model, errata |
| [Codes.md](./Codes.md) | Midnight ledger error codes + per-dApp assert messages |
| [Style.md](./Style.md) | voice, formatting, code-snippet, and tweet conventions |

---

## Status

The three dApps are demonstrators built for a Midnight developer bounty. They are **not** production financial infrastructure — the contracts have not been formally audited and several edge cases (partial redemptions, multi-class share splits, regulatory metadata) are intentionally simplified. Treat them as patterns to fork, not as drop-in replacements for a SEC-registered transfer agent.

If you find a bug or want to extend one, see [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## License

MIT — see [LICENSE](./LICENSE).
