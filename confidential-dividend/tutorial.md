# [Tutorial] Confidential Dividend Distribution on Midnight

> 📁 Full Source Code: [Midnight-dApps/confidential-dividend](https://github.com/ayushsingh82/Midnight-dApps/tree/main/confidential-dividend)

> Target audience: Developers building privacy-preserving capital-markets infrastructure on Midnight

A public cap table is the unsolved scandal of on-chain corporate finance. Every public corporation today reports aggregate shareholdings in 10-Q filings, but anyone who issues equity on a transparent blockchain effectively publishes positions of every holder, every insider, every family office — in real time, addressable by wallet ID forever.

This tutorial builds a dApp on the Midnight Network where:

- A corporate issuer registers shareholders, tops up a dividend pool, and declares per-share rates each quarter.
- Shareholders **claim dividends with ZK proofs** of inclusion — without revealing wallet, identity, or holding size.
- Nullifiers prevent any shareholder from claiming twice in the same cycle.
- Aggregate metrics (total holders, total payouts, pool size) stay publicly auditable.

## Prerequisites

- Node.js v20+
- 1AM or Lace wallet, on Preprod, funded with tNIGHT + tDUST
- Docker for the proof server
- Compact compiler from `https://github.com/midnightntwrk/compact`

## The privacy model

The dApp ships with three core privacy primitives — the same toolkit used in any Midnight ZK app:

1. **Commitment** — `H(secretKey, classId)`. The shareholder shares this with the issuer; the issuer learns nothing about identity.
2. **Merkle tree** — `HistoricMerkleTree<10, Bytes<32>>` of all registered commitments. Anyone can verify "commitment X is in the tree" but cannot enumerate leaves.
3. **Nullifier** — `H(secretKey, classId, cycle)`. Inserted into a `Set` on every claim. Same shareholder + same cycle = same nullifier = rejected.

## The contract

The full contract is ~110 lines. The core circuits:

```compact
export ledger issuer: Bytes<32>;
export ledger shareholderCommitments: HistoricMerkleTree<10, Bytes<32>>;
export ledger dividendNullifiers: Set<Bytes<32>>;
export ledger dividendPool: Uint<64>;
export ledger declaredDividend: Uint<64>;

witness localSecretKey(): Bytes<32>;
witness findShareholderPath(commit: Bytes<32>): MerkleTreePath<10, Bytes<32>>;

export circuit registerShareholder(holderCommit: Bytes<32>): [] {
    const sk = localSecretKey();
    assert(issuer == disclose(publicKey(sk)), "Not the issuer");
    shareholderCommitments.insert(disclose(holderCommit));
    totalShareholders.increment(1);
}

export circuit claimDividend(classId: Bytes<32>, cycle: Bytes<32>): Boolean {
    const sk = localSecretKey();
    const commit = shareholderCommit(sk, classId);
    const path = findShareholderPath(commit);
    assert(
        shareholderCommitments.checkRoot(disclose(merkleTreePathRoot<10, Bytes<32>>(path))),
        "Not a registered shareholder"
    );
    const nul = dividendNullifier(sk, classId, cycle);
    assert(!dividendNullifiers.member(disclose(nul)), "Dividend already claimed this cycle");
    assert(dividendPool >= declaredDividend, "Insufficient dividend pool");

    dividendNullifiers.insert(disclose(nul));
    dividendPool = (dividendPool - declaredDividend) as Uint<64>;
    totalDividendsPaid.increment(1);
    return disclose(true);
}
```

Note the three assertions in `claimDividend`:

1. **Inclusion** — the shareholder's commitment is in the Merkle tree.
2. **No reuse** — the nullifier hasn't been seen this cycle.
3. **Solvency** — the pool has enough for this payout.

If any fail, the proof fails and the tx is rejected by the wallet *before* any state change.

Compile it:

```bash
npx compact compile contracts/Contract.compact src/contracts
```

## Deterministic identity

A pattern worth memorising — every Midnight dApp in this collection uses it:

```ts
const masterKey = await deriveKeyFromPassword(password, addresses.shieldedCoinPublicKey);
const shareholderSk = await deriveKey(masterKey, 'dividend:shareholder');
const issuerSk      = await deriveKey(masterKey, 'dividend:issuer');
```

A 16+ character password combined with the wallet's `shieldedCoinPublicKey` (a public, deterministic value) seeds a SHA-256 → PBKDF2 chain. Same wallet + same password gives back the same keys forever; lose either and the identity is unrecoverable. This is how the dApp survives `localStorage` being cleared.

## End-to-end flow

### 1. Issuer deploys

```ts
const result = await deployContract(providers, {
  compiledContract: finalContract,
  privateStateId: PRIVATE_STATE_ID,
  initialPrivateState: createDividendPrivateState(issuerSk),
  args: [issuerSk],
});
```

The deployer's `publicKey(issuerSk)` is sealed into the contract. Only they can pass the `assert(issuer == publicKey(sk))` check later.

### 2. Shareholder computes a commitment

```ts
const commitment = contractModule.pureCircuits.getShareholderCommitment(
  shareholderSk,
  padTo32Bytes('COMMON-A'),
);
```

The shareholder sends this commitment (64-char hex) to the issuer via *any* off-chain channel — DM, email, KYC portal. The issuer cannot reverse-engineer the wallet from it.

### 3. Issuer registers the shareholder

```ts
const txInterface = createCircuitCallTxInterface(
  providers, finalContract, contractAddress, PRIVATE_STATE_ID,
);
await txInterface.registerShareholder(hexToUint8Array(commitment));
```

One Merkle-tree insert. The chain knows: "a new commitment was added." Nothing else.

### 4. Issuer declares + funds the cycle

```ts
await txInterface.topUpDividendPool(BigInt('1000000'));     // public top-up
await txInterface.declareCycleDividend(BigInt('250'));       // public rate
```

These are public state changes. Anyone, even random observers, can see "Acme Corp declared a Q2 dividend of 250 per share." That visibility is actually a *feature* — it's what regulators and the market need.

### 5. Shareholders claim

```ts
await txInterface.claimDividend(
  padTo32Bytes('COMMON-A'),
  padTo32Bytes('2026-Q2'),
);
```

The witness `findShareholderPath(commit)` resolves to the Merkle proof. The runtime generates a ZK proof, the wallet signs and balances, and the tx is submitted. The chain effect: one new nullifier, pool decremented, counter incremented. No wallet ID involved.

### 6. Auditors verify

A regulator querying the contract sees:

- `totalShareholders = 318`
- `totalDividendsPaid = 312`  (some holders haven't claimed yet)
- `dividendPool = 0`
- `declaredDividend = 250`

They can verify: every payout consumed exactly 250 from the pool, no duplicate nullifiers, every claim came from a commitment in the Merkle tree. They get full auditability **without** ever learning who holds shares.

## What about real money?

This tutorial uses the `dividendPool: Uint<64>` ledger as a synthetic accumulator. In production you'd settle real funds via a [shielded token](https://github.com/midnight-network/midnight-apps/tree/main/shielded-token), with the contract minting per-claim payouts to a stealth address derived from the same commitment.

## Wallet integration

Mirrors the reference fullstack-dapp. Highlights:

```ts
const wallets = getCompatibleWallets();         // discover injected wallets
const connectedApi = await wallet.connect('preprod');
const status = await connectedApi.getConnectionStatus();
const balances = await connectedApi.getShieldedBalances();
```

The Zustand store in `src/hooks/useWallet.ts` keeps `connectedApi`, addresses, and balances reactive everywhere.

## Indexer reads for the dashboard

```ts
const provider = indexerPublicDataProvider(INDEXER_HTTP, INDEXER_WS);
const state = await provider.queryContractState(contractAddress);
const ledger = contractModule.ledger(state.data);
// ledger.totalShareholders     → bigint
// ledger.totalDividendsPaid    → bigint
// ledger.dividendPool          → bigint
// ledger.declaredDividend      → bigint
```

For a production-quality dashboard, layer a small Express + Postgres polling cache in front (the pattern from the [fullstack-dapp tutorial](https://github.com/midnight-network/midnight-apps/blob/main/fullstack-dapp/tutorial.md)).

## Conclusion

A ~110-line Compact contract + four React pages give you a working privacy-preserving dividend distribution. The pattern generalises: any "issuer attests members → members prove inclusion → action is gated by a nullifier" workflow follows the same template.

## Troubleshooting

- **`Not the issuer`** → password/wallet mismatch between deploy and current session.
- **`Not a registered shareholder`** → issuer hasn't registered your commitment yet, or you derived it with a different password.
- **`Dividend already claimed this cycle`** → the nullifier is doing its job.
- **`Insufficient dividend pool`** → issuer needs to `topUpDividendPool` before more claims.
