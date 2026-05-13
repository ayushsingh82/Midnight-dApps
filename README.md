# Midnight dApps

A collection of privacy-preserving DApps built on the Midnight Network — leveraging zero-knowledge proofs, shielded ledger state, and the Compact smart contract language.

Each project demonstrates a different real-world finance use case where regulators and counterparties need auditable proofs while end users keep their sensitive data confidential.

## Projects

| dApp | One-liner | Article | Tweet |
|------|-----------|---------|-------|
| [confidential-real-estate](./confidential-real-estate) | Tokenized property shares with private ownership and rental yield data; ZK compliance. | [Read on DEV](./confidential-real-estate/tutorial.md) | [View tweet](./confidential-real-estate/TWEET.md) |
| [confidential-dividend](./confidential-dividend) | Automates dividend payouts while hiding shareholder identities; ZK verifies eligibility. | [Read on DEV](./confidential-dividend/tutorial.md) | [View tweet](./confidential-dividend/TWEET.md) |
| [confidential-asset-management](./confidential-asset-management) | Investors allocate to managers without public exposure of allocations or strategy. | [Read on DEV](./confidential-asset-management/tutorial.md) | [View tweet](./confidential-asset-management/TWEET.md) |

## Stack

All three dApps share a common stack:

- **Smart contracts:** Compact 0.22 (Midnight's ZK-DSL)
- **Frontend:** React 19 + Vite 8 + TypeScript + Tailwind v4
- **Wallet:** `@midnight-ntwrk/dapp-connector-api` (Lace, 1AM)
- **Network:** Midnight Preprod
- **Proof server:** local Docker image `midnightntwrk/proof-server:8.0.3`
- **Indexer:** `https://indexer.preprod.midnight.network/api/v4/graphql`

## Wallet

Install one of:

- **Lace** — `https://www.lace.io/` — Cardano-native wallet with Midnight Preprod support
- **1AM** — `https://1am.xyz/` — Midnight-first wallet

Fund your wallet with tNIGHT and tDUST from the Midnight Preprod faucet before deploying.

## Running a project

Each subfolder is independently runnable. From within any project:

```bash
npm install
npx compact compile contracts/Contract.compact src/contracts
docker run -p 6300:6300 midnightntwrk/proof-server:8.0.3 midnight-proof-server -v
npm run dev
```

## Documentation

- [README.md](./README.md) — this file
- [CONTRIBUTING.md](./CONTRIBUTING.md) — how to add a new dApp or improve existing ones
- [Methodology.md](./Methodology.md) — how the dApps were built, who wrote what, AI vs human roles
- [Codes.md](./Codes.md) — Midnight ledger error codes + per-dApp assert messages
- [Style.md](./Style.md) — voice, tone, code-snippet, and tweet conventions

## License

MIT — see [LICENSE](./LICENSE).
