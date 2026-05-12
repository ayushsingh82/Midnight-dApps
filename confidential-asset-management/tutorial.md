# [Tutorial] Confidential Asset Management on Midnight

> 📁 Full Source Code: [Midnight-dApps/confidential-asset-management](https://github.com/ayushsingh82/Midnight-dApps/tree/main/confidential-asset-management)

> Target audience: Developers building on-chain fund infrastructure

The TradFi-to-DeFi pipeline has stalled at one specific question: *how do you give LPs the speed and programmability of public chains without exposing the cap table and the alpha?* This tutorial answers that with a working Midnight dApp.

The model:

- A general partner (GP) deploys an on-chain fund.
- Limited partners (LPs) get admitted via commitments — the chain never learns who they are or how much they allocated, but it does track the **aggregate AUM**.
- The GP publishes **per-period ROI in basis points** so LPs and external observers can verify performance.
- LPs claim **per-period payouts** with a ZK proof of membership; a nullifier blocks double-claims.

## Prerequisites

- Node.js v20+
- 1AM or Lace wallet, on Preprod
- Some Preprod tNIGHT + tDUST
- Docker for the proof server
- The `compact` compiler

## The privacy/auditability trade

The interesting design decision is which fields are *public* and which are *private*:

| Field | Public? | Why |
|-------|---------|-----|
| `manager` | Yes | Sealed at deploy; identifies who can act as GP |
| LP commitments | Tree only | The chain sees the leaves, not the wallet/identity |
| LP allocation | **Public** (added to `aum`) | So solvency checks are credible; not linked to wallet |
| `aum` | Yes | Public AUM for compliance; no per-LP breakdown |
| `reportedRoiBp` | Yes | LP/regulator verifiability |
| Per-LP holdings | Off-chain | GP keeps the books |
| Strategy | Off-chain | The GP's edge |
| Payouts | Amounts public, recipients private | Same pattern as the dividend dApp |

This is the *opposite* trade-off of every existing on-chain fund. Tribute Protocol, Enzyme, etc. leak per-wallet holdings on a public chain; off-chain funds (Citadel, et al.) leak nothing on-chain. Midnight finds the third option.

## The contract

```compact
export ledger manager: Bytes<32>;
export ledger lpCommitments: HistoricMerkleTree<10, Bytes<32>>;
export ledger payoutNullifiers: Set<Bytes<32>>;
export ledger aum: Uint<64>;
export ledger reportedRoiBp: Uint<64>;

constructor(managerSk: Bytes<32>) {
    manager = disclose(publicKey(managerSk));
}

export circuit admitLp(holderCommit: Bytes<32>, allocation: Uint<64>): [] {
    const sk = localSecretKey();
    assert(manager == disclose(publicKey(sk)), "Not the fund manager");
    lpCommitments.insert(disclose(holderCommit));
    aum = (aum + allocation) as Uint<64>;
    totalLps.increment(1);
}

export circuit claimPayout(fundId: Bytes<32>, period: Bytes<32>, amount: Uint<64>): Boolean {
    const sk = localSecretKey();
    const commit = lpCommit(sk, fundId);
    const path = findLpPath(commit);
    assert(
        lpCommitments.checkRoot(disclose(merkleTreePathRoot<10, Bytes<32>>(path))),
        "Not an LP of this fund"
    );
    const nul = payoutNullifier(sk, fundId, period);
    assert(!payoutNullifiers.member(disclose(nul)), "Payout already claimed for this period");
    assert(aum >= amount, "Payout exceeds AUM");

    payoutNullifiers.insert(disclose(nul));
    aum = (aum - amount) as Uint<64>;
    totalPayouts.increment(1);
    return disclose(true);
}
```

Note: `admitLp` accepts the allocation as a disclosed argument. We do this on purpose — the *aggregate* AUM must be public for solvency. The privacy comes from breaking the link between `aum` and per-LP holdings.

## Deterministic GP and LP identities

The same wallet can act as either GP or LP across different funds by deriving role-scoped keys:

```ts
const masterKey = await deriveKeyFromPassword(password, addresses.shieldedCoinPublicKey);
const managerSk = await deriveKey(masterKey, 'fund:manager');
const lpSk      = await deriveKey(masterKey, 'fund:lp');
```

So a family office can run its own funds (as manager) while allocating to others (as LP) — same wallet, two scoped identities.

## End-to-end flow

### 1. GP deploys

```ts
const result = await deployContract(providers, {
  compiledContract: finalContract,
  privateStateId: PRIVATE_STATE_ID,
  initialPrivateState: createFundPrivateState(managerSk),
  args: [managerSk],
});
```

The deployer's `publicKey(managerSk)` is sealed on-chain.

### 2. LP computes a commitment

```ts
const commit = contractModule.pureCircuits.getLpCommitment(
  lpSk,
  padTo32Bytes('GLOBAL-MACRO-I'),
);
```

The LP shares this commitment with the GP over any off-chain channel. The GP performs KYC, due-diligence, and allocation agreement off-chain.

### 3. GP admits the LP

```ts
await txInterface.admitLp(hexToUint8Array(commit), BigInt(5_000_000));
```

On-chain: one new Merkle leaf, AUM += 5_000_000, totalLps += 1. The chain doesn't know it was *this* LP that contributed 5M.

### 4. GP reports ROI

```ts
await txInterface.reportRoi(BigInt(1200));  // +12.00%
```

Public. Anyone can verify Acme Macro Fund hit 1200 bp in May 2026.

### 5. LP claims payout

```ts
await txInterface.claimPayout(
  padTo32Bytes('GLOBAL-MACRO-I'),
  padTo32Bytes('2026-05'),
  BigInt(60_000),
);
```

The LP supplies the amount (calculated off-chain by combining their private allocation with the public ROI). The contract enforces:

- Membership in the Merkle tree
- Nullifier hasn't been used for `(lp, fund, period)`
- AUM has enough headroom

Chain effect: nullifier added, AUM debited, counter incremented.

### 6. Auditor view

A regulator querying the indexer sees:

- `manager` = sealed GP key
- `totalLps` = 14
- `totalPayouts` = 13
- `aum` = 67,250,000
- `reportedRoiBp` = 1200

They can verify each payout consumed exactly the declared amount, no nullifier was reused, every claim came from a commitment in the tree. They get full **process** auditability without learning **who** holds what.

## Wallet integration

Same pattern as the other dApps in this repo. The `useWalletStore` (Zustand) keeps `connectedApi`, addresses, and balances reactive everywhere:

```ts
const wallets = getCompatibleWallets();
await wallet.connect('preprod');
const addresses = await connectedApi.getShieldedAddresses();
```

## Reading state

```ts
const provider = indexerPublicDataProvider(INDEXER_HTTP, INDEXER_WS);
const state = await provider.queryContractState(contractAddress);
const ledger = contractModule.ledger(state.data);
// ledger.totalLps         → bigint
// ledger.aum              → bigint
// ledger.reportedRoiBp    → bigint
```

For a polished investor dashboard, drop in the analytics-server pattern from the [fullstack-dapp tutorial](https://github.com/midnight-network/midnight-apps/blob/main/fullstack-dapp/tutorial.md): poll the indexer every 15 seconds, cache in Postgres, serve a `/fund` endpoint to the frontend.

## Extensions worth building

- **Partial redemptions** — extend `redeemLp` to support a `Map<Bytes<32>, Uint<64>>` of remaining allocations.
- **Per-LP performance fees** — derive a "high-water mark" nullifier and gate performance-fee claims behind it.
- **Multi-fund routing** — turn `manager` into a `Map<fundId, Bytes<32>>` so one contract hosts many funds.
- **Real settlement** — pair with a [shielded token](https://github.com/midnight-network/midnight-apps/tree/main/shielded-token) for the actual cash movement.

## Conclusion

Confidential asset management has been the missing piece in on-chain finance. With ~140 lines of Compact and four React pages, you get a real working LP/GP fund that gives institutions the privacy they need while preserving on-chain auditability.

## Troubleshooting

- **`Not the fund manager`** → wallet/password mismatch since deploy.
- **`Not an LP of this fund`** → GP hasn't admitted your commitment, or you used the wrong `fundId` when computing it.
- **`Payout already claimed for this period`** → nullifier is working.
- **`Payout exceeds AUM`** → GP needs to fund the AUM or LPs are over-claiming.
