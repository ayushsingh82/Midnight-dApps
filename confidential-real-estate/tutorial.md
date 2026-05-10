# [Tutorial] Building Confidential Tokenized Real Estate on Midnight

> 📁 Full Source Code: [Midnight-dApps/confidential-real-estate](https://github.com/ayushsingh82/Midnight-dApps/tree/main/confidential-real-estate)

> Target audience: Developers building privacy-preserving fintech on the Midnight Network

Tokenizing real estate has been "the next big thing" for nearly a decade. The technology has been ready since the first ERC-20; the regulatory model has always been the blocker. Every public REIT-on-chain attempt has either had to publicly leak shareholder positions (killing institutional adoption) or punt to off-chain custodians (defeating the point of being on-chain).

Midnight changes that. In this tutorial we build a DApp where:

- Property sponsors tokenize a building, issue fractional shares, and pay rental yield each cycle.
- Investors prove ownership and claim rental cashflows **without revealing** which wallet they are, how many shares they hold, or when they joined the cap table.
- Regulators and auditors can still **verify in zero-knowledge** that every payout went to a legitimate shareholder and that no double-claims occurred.

## Prerequisites

- Node.js v20+
- A Midnight wallet (1AM or Lace) on Preprod
- Some Preprod tNIGHT + tDUST from the faucet
- Docker (we run the proof server locally)
- The `compact` compiler:

```bash
curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
```

## The contract: the privacy bricks

The whole privacy story rests on three Compact primitives:

1. **Commitment** — a hash of `(secretKey, propertyId)` that the investor computes off-chain and shares with the sponsor. The sponsor learns nothing useful from it.
2. **Merkle tree** — the sponsor inserts each commitment into a `HistoricMerkleTree<10, Bytes<32>>`. Anyone can compute the root, nobody can enumerate leaves.
3. **Nullifier** — a deterministic hash of `(secretKey, propertyId, cycle)` that gets inserted into a `Set` the moment a yield claim is processed. Same investor + same cycle = same nullifier = double-claim is rejected.

Here is the contract heart:

```compact
export ledger ownershipCommitments: HistoricMerkleTree<10, Bytes<32>>;
export ledger yieldClaimNullifiers: Set<Bytes<32>>;
export ledger rentalPoolAvailable: Uint<64>;

witness localSecretKey(): Bytes<32>;
witness findOwnershipPath(commit: Bytes<32>): MerkleTreePath<10, Bytes<32>>;

constructor(sponsorSk: Bytes<32>) {
    sponsor = disclose(publicKey(sponsorSk));
}

export circuit issueShare(holderCommit: Bytes<32>): [] {
    const sk = localSecretKey();
    assert(sponsor == disclose(publicKey(sk)), "Not the sponsor");
    ownershipCommitments.insert(disclose(holderCommit));
    totalShares.increment(1);
}

export circuit proveOwnership(propertyId: Bytes<32>): Boolean {
    const sk = localSecretKey();
    const commit = ownershipCommit(sk, propertyId);
    const path = findOwnershipPath(commit);
    assert(
        ownershipCommitments.checkRoot(disclose(merkleTreePathRoot<10, Bytes<32>>(path))),
        "Not an owner of this property"
    );
    return disclose(true);
}
```

Note the symmetry with the attestation pattern in the [fullstack DApp tutorial](https://github.com/midnight-network/midnight-apps/blob/main/fullstack-dapp/tutorial.md): the sponsor here plays the same role as the authority there.

Compile it:

```bash
npx compact compile contracts/Contract.compact src/contracts
```

This emits `src/contracts/managed/realestate/contract/index.js` plus the ZK proving keys and verifier under `src/contracts/managed/realestate/keys/`.

## The investor identity

Storing private keys in `localStorage` is a recipe for losing user funds the moment they clear cookies. Midnight DApps solve this by deriving the key deterministically each session from `password + wallet.shieldedCoinPublicKey`:

```ts
const masterKey = await deriveKeyFromPassword(password, shieldedCoinPublicKey);
const investorSk = await deriveKey(masterKey, 'realestate:investor');
const sponsorSk  = await deriveKey(masterKey, 'realestate:sponsor');
```

Same wallet + same password ⇒ same secret key forever. Lose the password and the identity is unrecoverable — by design.

## Generating the ownership commitment

The investor computes the commitment off-chain and DMs it to the sponsor. The sponsor never sees the secret key, only the hash:

```ts
const commitment = contractModule.pureCircuits.getOwnershipCommitment(
  investorSk,
  padTo32Bytes(propertyId)
);
```

In `src/pages/Home.tsx` we wire that up to a property-ID input box so the investor can copy a commitment with two clicks.

## Issuing shares

Once the sponsor has a commitment, they call `issueShare`. The Midnight transaction pipeline does the heavy lifting — the witness `localSecretKey()` resolves the sponsor secret from local private state, the contract enforces `sponsor == publicKey(sk)`, and a ZK proof is generated and submitted by the wallet:

```ts
const txInterface = createCircuitCallTxInterface(
  providers, finalContract, contractAddress, PRIVATE_STATE_ID
);
await txInterface.issueShare(hexToUint8Array(holderCommit));
```

The on-chain effect: one new leaf in the `ownershipCommitments` tree, `totalShares` incremented. No wallet address, no investor name.

## Proving ownership

When an investor needs to prove they own *some* share of a property — say, to log into a private investor portal — they call `proveOwnership`:

```ts
await txInterface.proveOwnership(padTo32Bytes(propertyId));
```

The witness `findOwnershipPath(commit)` fetches the Merkle path locally (the investor's private state has been syncing in the background). The circuit asserts the path roots match a historic root of the tree, generating a ZK proof that the investor's commitment is in the tree without revealing which leaf.

## Claiming rental yield

The sponsor periodically calls `depositRent(amount)` which adds to the `rentalPoolAvailable`. Investors then call `claimYield`:

```compact
export circuit claimYield(
  propertyId: Bytes<32>, cycle: Bytes<32>, amount: Uint<64>
): Boolean {
    const sk = localSecretKey();
    const commit = ownershipCommit(sk, propertyId);
    const path = findOwnershipPath(commit);
    assert(
        ownershipCommitments.checkRoot(disclose(merkleTreePathRoot<10, Bytes<32>>(path))),
        "Not an owner of this property"
    );
    const nul = yieldNullifier(sk, propertyId, cycle);
    assert(!yieldClaimNullifiers.member(disclose(nul)), "Yield already claimed this cycle");
    assert(rentalPoolAvailable >= amount, "Insufficient rental pool");
    yieldClaimNullifiers.insert(disclose(nul));
    rentalPoolAvailable = (rentalPoolAvailable - amount) as Uint<64>;
    totalYieldClaims.increment(1);
    return disclose(true);
}
```

Two assertions matter:

- `checkRoot(...)` proves ownership.
- `!usedNullifiers.member(nul)` blocks double-claims for the same `(investor, property, cycle)`.

The chain learns: *someone* who owns this property has claimed `amount` for this cycle. It never learns *who*.

## Front-end wallet integration

Connection follows the same pattern as the reference fullstack-dapp:

```ts
const wallets = getCompatibleWallets();           // discover injected wallets
setWallet(selected);                              // remember the selection
const connectedApi = await wallet.connect('preprod');
const addresses = await connectedApi.getShieldedAddresses();
```

The Zustand store in `src/hooks/useWallet.ts` keeps `connectedApi`, addresses, and balances reactive across pages.

## Reading aggregate state

Anyone — including unauthenticated users — can query the indexer to get aggregate stats:

```ts
const provider = indexerPublicDataProvider(INDEXER_HTTP, INDEXER_WS);
const state = await provider.queryContractState(contractAddress);
const ledger = contractModule.ledger(state.data);
// ledger.totalShares          → bigint
// ledger.totalYieldClaims     → bigint
// ledger.rentalPoolAvailable  → bigint
```

These are perfect for a public marketing page: "12 properties, $4.2M rental pool, 318 anonymous holders" — no individual holdings disclosed.

## What this unlocks

- **Family offices** can hold real-estate exposure without their portfolio leaking to LPs, prime brokers, or the chain.
- **REIT issuers** can demonstrate compliance (every payout went to a verified holder) without surrendering shareholder lists.
- **Auditors** can verify aggregate flows match deposits and that no nullifier was reused.

## Next steps

- Add per-share weighting (currently each commitment is "one share"). Extend the contract with a `Map<Bytes<32>, Uint<64>>` for share counts.
- Plug an off-chain analytics server (mirrors the `node-analytics` folder in fullstack-dapp) to cache totals in Postgres.
- Combine with a [shielded token](https://github.com/midnight-network/midnight-apps/tree/main/shielded-token) for the rental-pool denomination.

## Troubleshooting

- **Wallet not detected** → install Lace or 1AM, refresh.
- **Tx failing** → make sure your wallet has tDUST and the proof server is running on `:6300`.
- **`Not an owner of this property`** → the sponsor hasn't issued you a share yet, or you're computing the commitment with a different password.
- **`Yield already claimed this cycle`** → the nullifier check is doing its job.

That's it — a confidential real-estate DApp in roughly 130 lines of Compact and one React page per role.
