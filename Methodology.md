# Methodology & Technical Authorship

This document explains how the three dApps in this repository, their tutorials, and their on-chain integrations were built — and how to interpret the contents.

## Scope

| | |
|---|---|
| **Network** | Preprod |
| **Compact compiler** | 0.22 (smart-contract language version) |
| **Midnight.js** | 4.0.4 |
| **DApp Connector API** | 4.0.1 |
| **Ledger** | v8 |
| **Frontend** | React 19 + Vite 8 + TypeScript + Tailwind v4 |
| **Wallets tested** | 1AM, Lace |

## Projects

| dApp | Domain | Privacy primitive |
|------|--------|-------------------|
| [confidential-real-estate](./confidential-real-estate) | Tokenized property shares | Ownership commitment + per-cycle yield nullifier |
| [confidential-dividend](./confidential-dividend) | Private dividend distribution | Shareholder commitment + per-cycle dividend nullifier |
| [confidential-asset-management](./confidential-asset-management) | Fund LP allocations | LP commitment + per-period payout nullifier; public AUM/ROI |

All three intentionally share the **same Compact primitives** (`HistoricMerkleTree<10, Bytes<32>>` + `Set<Bytes<32>>` nullifier + `localSecretKey()` witness) so a developer who learns one can read the other two in minutes.

## Who wrote what

| Artifact | Primary Author | AI Role | Human Verification |
|----------|---------------|---------|--------------------|
| Compact contracts | AI-drafted, human-directed | Generated based on a privacy spec (commitment scheme, nullifier scheme, role checks) | Manually reviewed against the Compact language reference and the [midnight-apps/fullstack-dapp](https://github.com/midnight-network/midnight-apps/tree/main/fullstack-dapp) reference contract |
| React frontend | AI (human-directed) | Generated from a UX brief (pages: Home, Deploy, role-specific actions) | Local testing in Vite dev server; route guards and wallet detection adjusted after live runs |
| Wallet integration | Adapted from reference | Reused the `useWallet` Zustand store pattern from the official midnight-apps repo | Auto-reconnect, error surface, and wallet-discovery polling were added based on real injection-timing issues observed in Chrome |
| Tutorial prose | Mixed | AI drafted; human edits emphasised privacy-vs-auditability trade-offs and rewrote opening paragraphs in author voice | Each `tutorial.md` cross-checked against its own `Contract.compact` so code snippets cannot drift from the actual source |
| README(s) | AI (human-directed) | Generated from `tutorial.md` + `Contract.compact` | Author reviewed |

## Privacy model — one paragraph

Every dApp here follows the same three-step pattern:

1. **Off-chain**, the user (investor / shareholder / LP) computes `commitment = persistentHash(secretKey, scopeId)`. The secret key is derived deterministically from `password + wallet.shieldedCoinPublicKey`, so identities survive a `localStorage` wipe but are unrecoverable if the password is lost.
2. **On-chain**, the authority (sponsor / issuer / GP) inserts the commitment into a `HistoricMerkleTree<10, Bytes<32>>`. The chain only ever sees the leaf, never the wallet, allocation, or identity.
3. **On-chain**, the user later proves inclusion in zero knowledge and submits a per-action nullifier. The nullifier set blocks replays (same shareholder claiming the same dividend twice, etc.).

## Frontend architecture — one paragraph

Each dApp is a single-page React app. The wallet store (`useWalletStore`, Zustand) holds the injected wallet handle, the connected API, and the derived addresses. A reusable provider bundle in `src/lib/midnight.ts` wires up `indexerPublicDataProvider`, `levelPrivateStateProvider`, `FetchZkConfigProvider`, `httpClientProofProvider`, and the `balanceTx`/`submitTx` adapters around the wallet's `balanceUnsealedTransaction` and `submitTransaction` calls. Pages call `createCircuitCallTxInterface(...)` and invoke circuits as `await txInterface.someCircuit(args)`.

## Identity model — one paragraph

`password + wallet.shieldedCoinPublicKey → PBKDF2(SHA-256, 100k iterations) → masterKey → SHA-256(masterKey || purpose) → secretKey`. Same wallet + same password produces the same `secretKey` deterministically across browsers, devices, and `localStorage` wipes. Lose either input and the identity is gone forever — there is no recovery, no remote storage, and no escrow.

## Why three dApps instead of one big one?

The vertical (RWA / corporate finance / asset management) was chosen to demonstrate that Midnight's primitives generalise. The contracts share a pattern but are not identical — each one tunes the trade-off between public auditability and per-user privacy slightly differently:

- **Real estate** — investors anonymous, rental pool public.
- **Dividend** — shareholders anonymous, payout rates and totals public.
- **Asset management** — LPs anonymous, AUM and ROI public (so the GP can prove performance).

Reading the three contracts side-by-side is the fastest way to learn how to design your own.

## Wallets, dust, and proof server

All three dApps assume:

- A Lace or 1AM wallet on Preprod, funded with tNIGHT and tDUST from the faucet
- A local proof server: `docker run -p 6300:6300 midnightntwrk/proof-server:8.0.3 midnight-proof-server -v`
- An internet connection to the Preprod indexer at `https://indexer.preprod.midnight.network/api/v4/graphql`

If transactions fail with `BalanceCheckOverspend`, the wallet is out of tDUST — top up before retrying.

## Work in progress

These dApps are demonstrators, not production financial infrastructure. The contracts have not been formally audited, and the redemption / partial-withdrawal flows in `confidential-asset-management` are intentionally simple. Treat the patterns as a starting point for real implementations, not a drop-in replacement for a SEC-registered transfer agent.

## Errata and live discoveries

Issues that emerged after the initial draft and were patched into the live code:

- Vite 8 statically analyses dynamic-import template literals even with `/* @vite-ignore */`. Fixed by switching to string concatenation in `import()` paths.
- Wallet extensions sometimes inject `window.midnight` *after* the initial React render. Fixed by polling `getCompatibleWallets()` for ~3 seconds in `ConnectButton.tsx`.
- Pages that require a connected wallet were navigable via direct URL. Fixed with a `RequireWallet` route guard that redirects to `/`.

The tutorials are living documents: entries are corrected or expanded as new behaviour is observed on Preprod.
