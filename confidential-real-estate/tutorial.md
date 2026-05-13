# Building Confidential Tokenized Real Estate on Midnight

> 📖 Published version: https://dev.to/ayush_singh_4525768ba4731/-tutorial-building-confidential-tokenized-real-estate-on-midnight-26o9
>
> 📁 Source: [Midnight-dApps/confidential-real-estate](https://github.com/ayushsingh82/Midnight-dApps/tree/main/confidential-real-estate)

I've been watching real-estate tokenisation projects come and go for years. Every one of them has the same blocker: cap-table privacy. The minute you put a property's ownership on a transparent ledger, you're publishing who owns what to the entire world. Family offices won't touch it. RIAs won't touch it. And the institutional money that this market needs to scale just isn't going to show up.

Midnight changes the math. The chain stores commitments instead of identities, ZK proofs replace public lookups, and suddenly the trade-off between regulatory auditability and shareholder privacy goes away.

This is a working dApp that demonstrates the pattern. I'll walk through the contract function by function, the React frontend that talks to it, the wallet integration, and the bits that took me longer than they should have.

## What we're actually building

A property sponsor (think: a building owner or a REIT issuer) deploys a contract. They can issue fractional shares in a property by inserting an investor's *commitment* into a Merkle tree. The investor can then later prove ownership of that property in zero knowledge, and claim a slice of the rental pool each cycle.

The bits that are public:

- Total number of properties registered
- Total shares issued (count of leaves in the tree)
- Rental pool size
- Total yield claims processed

The bits that stay private:

- Which wallet owns which property
- Each holder's allocation size
- The mapping between commitments and real-world identities

That mapping happens off-chain, between the investor and the sponsor. The sponsor does KYC, decides allocations, and only puts a hash into the tree. Everyone after that point sees only the tree.

## Why this dApp could actually ship

Three concrete use cases I'd build on top of this:

1. **Family-office REIT** — a single private REIT that wants to onboard 40-50 family offices without leaking any of their positions to each other. Today this is done with paper certificates and an SS&C transfer agent. Move it to Midnight and you keep the privacy but settle in seconds.

2. **Fractional luxury rentals** — Airbnb-style rentals where the building is fractionally owned by users, and rental income flows back to holders pro-rata. Users want to invest without doxxing themselves as owners of a specific building.

3. **Regulated tokenised mortgages** — the lender is a public entity but the borrowers / co-investors want their participation hidden from competitors. Aggregate compliance numbers (total loaned, total outstanding) stay public; per-borrower amounts don't.

## Prerequisites

- Node 20+
- Lace or 1AM wallet, on the Midnight Preprod network
- Some tNIGHT and tDUST from the Preprod faucet
- Docker (for the local proof server)
- The Compact compiler — `curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh`

## The contract, function by function

The whole contract is about 110 lines. Here's the full ledger declaration first:

```compact
pragma language_version 0.22;
import CompactStandardLibrary;

export sealed ledger sponsor: Bytes<32>;

export ledger ownershipCommitments: HistoricMerkleTree<10, Bytes<32>>;
export ledger yieldClaimNullifiers: Set<Bytes<32>>;

export ledger totalProperties: Counter;
export ledger totalShares: Counter;
export ledger totalYieldClaims: Counter;

export ledger rentalPoolAvailable: Uint<64>;
```

A few things worth pointing out before we move on:

- `sealed ledger` for the sponsor means the value can only be set once, in the constructor. After that, no circuit can change it. This is how we enforce "only the sponsor can issue shares."
- `HistoricMerkleTree<10, Bytes<32>>` is a tree of depth 10 (so up to 2¹⁰ = 1024 leaves) where each leaf is 32 bytes. The "historic" part is crucial: proofs against past roots stay valid, which means an investor whose commitment was added 50 blocks ago can still prove they're in the tree.
- `Set<Bytes<32>>` for nullifiers gives us O(log n) double-claim prevention. Once a nullifier goes in, the contract rejects any future tx that tries to add the same one.
- `Counter` and `Uint<64>` are public scalars. Anyone can read them off the indexer.

### `constructor(sponsorSk: Bytes<32>)`

```compact
constructor(sponsorSk: Bytes<32>) {
    sponsor = disclose(publicKey(sponsorSk));
}
```

The constructor takes the sponsor's secret key (32 bytes, witness data — never appears on chain) and seals the corresponding public key into the contract. `disclose(...)` tells the compiler this value crosses the public-private boundary on purpose.

`publicKey()` is a private helper:

```compact
circuit publicKey(sk: Bytes<32>): Bytes<32> {
    return persistentHash<Vector<2, Bytes<32>>>(
        [pad(32, "realestate:pk:v1"), sk]
    );
}
```

The `pad(32, "realestate:pk:v1")` is a 32-byte domain separator. Without it, the same secret key could collide with a public key in a different dApp using the same hash function. The `:v1` suffix is there in case we ever want to migrate to a different hash without invalidating identities.

### `getOwnershipCommitment(sk, propertyId)`

This is the only circuit the *frontend* calls off-chain. It's marked `export` and uses `pureCircuits`, which means it runs in JavaScript without producing a transaction:

```compact
circuit ownershipCommit(sk: Bytes<32>, propertyId: Bytes<32>): Bytes<32> {
    return persistentHash<Vector<3, Bytes<32>>>(
        [pad(32, "realestate:own:v1"), propertyId, sk]
    );
}

export circuit getOwnershipCommitment(sk: Bytes<32>, propertyId: Bytes<32>): Bytes<32> {
    return ownershipCommit(sk, propertyId);
}
```

This is what produces the 64-character hex string the investor copies on the Home page. It's deterministic: the same wallet + same property always gives the same commitment. That's what makes "lose your password, lose your identity" actually work — there's no extra randomness needed, the wallet is sufficient.

### `issueShare(holderCommit)` — sponsor-only

```compact
export circuit issueShare(holderCommit: Bytes<32>): [] {
    const sk = localSecretKey();
    assert(sponsor == disclose(publicKey(sk)), "Not the sponsor");
    ownershipCommitments.insert(disclose(holderCommit));
    totalShares.increment(1);
}
```

Three things happening here:

1. The witness `localSecretKey()` pulls the caller's secret key out of their private state. (We'll see how this is wired up shortly.)
2. The assertion `sponsor == publicKey(sk)` is what gates this circuit to the sponsor only. If any other wallet tries to call `issueShare`, their `publicKey(sk)` won't match the sealed `sponsor` and the proof generation fails before a transaction is ever submitted.
3. The commitment goes into the tree. The chain learns that *a* new leaf was added — nothing about who.

`totalShares.increment(1)` is a public counter and useful for dashboards. You could also have the sponsor pass an explicit share count and increment by that amount, but I kept it simple.

### `registerProperty()` — sponsor-only

```compact
export circuit registerProperty(): [] {
    const sk = localSecretKey();
    assert(sponsor == disclose(publicKey(sk)), "Not the sponsor");
    totalProperties.increment(1);
}
```

This is a bookkeeping circuit that just bumps a counter. You'd call it once per property the sponsor onboards, so the public dashboard can show "12 properties registered." It doesn't change anything else.

### `depositRent(amount)` — sponsor-only

```compact
export circuit depositRent(amount: Uint<64>): [] {
    const sk = localSecretKey();
    assert(sponsor == disclose(publicKey(sk)), "Not the sponsor");
    rentalPoolAvailable = (rentalPoolAvailable + amount) as Uint<64>;
}
```

Adds to the rental pool. Public on-chain because everyone watching the tree wants to know how much money is available for yield claims this cycle.

In a real system the sponsor wouldn't just add to a counter — they'd send actual tokens to the contract. You can pair this with a [shielded token](https://github.com/midnight-network/midnight-apps/tree/main/shielded-token) and have `depositRent` accept a coin commitment.

### `proveOwnership(propertyId)` — investor

```compact
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

This is where the ZK magic happens. The investor:

1. Fetches their own secret key via `localSecretKey()` (witness).
2. Recomputes their commitment locally — `ownershipCommit(sk, propertyId)`.
3. Asks the witness `findOwnershipPath(commit)` to provide the Merkle path from that commitment to a root the tree has seen.
4. Asserts the path roots match. If they do, the proof succeeds.

The on-chain effect of a successful call: nothing. No state changes. The wallet just records that the tx was submitted. But the chain has now mathematically certified that *somebody* who owns property X has proven ownership — without revealing who.

This is useful for "did you own this property at any point" verifications. A KYC portal, a tenant directory, a benefits programme — anything that needs proof of ownership without leaking identity.

### `claimYield(propertyId, cycle, amount)` — investor

```compact
export circuit claimYield(propertyId: Bytes<32>, cycle: Bytes<32>, amount: Uint<64>): Boolean {
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

Same ownership check as `proveOwnership`, plus three more assertions:

1. The nullifier `H(sk, propertyId, cycle)` hasn't been seen before. If it has, this investor already claimed for this cycle.
2. The rental pool has enough funds for this payout.
3. We insert the nullifier and decrement the pool.

The `cycle` argument is what makes this work over time. Every quarter the sponsor sets a new cycle ID ("2026-Q2", "2026-Q3"), and each (investor, property, cycle) tuple produces a fresh nullifier. Without the cycle in the nullifier hash, the investor could only ever claim once and never again.

You'll notice `amount` is public — it has to be, so the pool can be decremented correctly. The privacy isn't in the amount, it's in *who's claiming*. If you want amounts to be private too, you'd shield the rental pool itself and pay out from there.

## The witnesses

Witnesses are the link between the on-chain circuit and the off-chain private state. Two of them:

```ts
// confidential-real-estate/src/pages/witnesses.ts
export const witnesses = {
  localSecretKey: ({ privateState }) => [privateState, privateState.secretKey],
  findOwnershipPath: ({ privateState, ledger }, commit) => {
    const path = ledger.ownershipCommitments.findPathForLeaf(commit);
    if (!path) throw new Error('Ownership commitment not found in tree');
    return [privateState, path];
  },
};
```

`localSecretKey` just hands the circuit the secret key from the local private state — never touches the chain.

`findOwnershipPath` is a bit cleverer. It looks at the *local* copy of the ledger that the Midnight.js client has been syncing in the background, walks the Merkle tree, and finds the path from the requested commitment to the root. That path is what `proveOwnership` and `claimYield` verify on-chain.

If the commitment isn't in the local tree yet — for example, the sponsor only just added it and our client hasn't caught up — `findPathForLeaf` returns null and we throw. The wallet displays the error to the user.

## The deterministic identity

Every action on the dApp is signed with a key derived from your wallet:

```ts
// confidential-real-estate/src/hooks/useIdentity.ts
const APP_SALT = 'confidential-real-estate-v1';

export async function deriveRoleKey(shieldedCoinPublicKey, role) {
  const master = await deriveKeyFromPassword(APP_SALT, shieldedCoinPublicKey);
  return deriveKey(master, `realestate:${role}`);
}
```

`deriveKeyFromPassword` is PBKDF2 with 100,000 iterations of SHA-256. The "password" here is a static salt; the per-user entropy comes from `shieldedCoinPublicKey`, which is fully determined by the wallet's seed phrase. Same wallet → same key, always.

Earlier versions of this dApp had a separate user password on top of this. I dropped it because it was just adding a UX step without meaningful security gain — if someone has your wallet seed, they already control your assets; an extra password doesn't help. (If you want belt-and-braces security, add a passphrase wallet-side, not dApp-side.)

## Wiring up the providers

The frontend talks to Midnight through a bundle of providers, one for each concern:

```ts
// shape (real wiring is in src/pages/Deploy.tsx)
const providers = {
  privateStateProvider: levelPrivateStateProvider({ privateStateStoreName: 'realestate' }),
  publicDataProvider:   indexerPublicDataProvider(INDEXER_HTTP, INDEXER_WS),
  zkConfigProvider:     new FetchZkConfigProvider(`${CONTRACT_PATH}/managed/realestate/keys`, fetch.bind(window)),
  proofProvider:        httpClientProofProvider(PROOF_SERVER, zkConfig),
  walletProvider:       { ...balanceTx + getCoinPublicKey adapters... },
  midnightProvider:     { ...submitTx adapter... },
};
```

In English:

- `privateStateProvider` is the local IndexedDB store for your secret key + cached tree state. Clearing browser storage clears this — but since the key is deterministic, it gets rederived on next page load.
- `publicDataProvider` reads chain state from the GraphQL indexer at `indexer.preprod.midnight.network`.
- `zkConfigProvider` loads the proving/verifier keys generated by `compact compile`. Heavy artefacts (~megabytes each).
- `proofProvider` is your local proof server at `localhost:6300`. Heavy CPU work happens here.
- `walletProvider` adapts the Midnight JS transaction format to whatever your wallet extension expects.
- `midnightProvider` does the final submit.

## Deploying the contract

```ts
const { finalContract } = await loadCompiledContract();
const result = await deployContract(providers, {
  compiledContract: finalContract,
  privateStateId: PRIVATE_STATE_ID,
  initialPrivateState: createRealEstatePrivateState(sponsorSk),
  args: [sponsorSk],
});
const contractAddress = result.deployTxData.public.contractAddress;
```

`args: [sponsorSk]` is what gets passed to the Compact constructor. The sponsor public key gets sealed in, and now only this wallet (or anyone who knows their seed) can ever call `issueShare` or `depositRent`.

The contract address is a 64-char hex string. We stash it in `localStorage` so the rest of the app knows which contract to talk to.

## Submitting a circuit call

After the contract is deployed, every circuit call follows the same shape:

```ts
const txInterface = createCircuitCallTxInterface(
  providers, finalContract, contractAddress, PRIVATE_STATE_ID
);
await txInterface.issueShare(hexToUint8Array(holderCommit));
```

Internally that does roughly:

1. Look up the circuit by name on the compiled contract.
2. Resolve witnesses against your private state.
3. Build an unsigned transaction including the ZK proof.
4. Hand it to the wallet provider to balance and sign.
5. Submit through the midnight provider.

If anything fails — invalid commitment, mismatched root, proof timeout — the wallet popup shows the error and the chain state stays clean.

## The Home dashboard

The investor's Home page shows a property gallery (London / NYC / Singapore mock listings), the live commitment for whichever property is selected, the contract address, and a quick-action grid.

```tsx
// src/pages/Home.tsx (simplified)
const investorSk = useIdentity('investor');
useEffect(() => {
  if (!investorSk) return;
  const data = new Uint8Array(64);
  data.set(investorSk);
  data.set(padTo32Bytes(propertyId), 32);
  const hash = await crypto.subtle.digest('SHA-256', data);
  setCommitHex(uint8ArrayToHex(new Uint8Array(hash)));
}, [investorSk, propertyId]);
```

This is a SHA-256 sketch of the commitment — it's not bit-for-bit identical to what `getOwnershipCommitment` produces on-chain (which uses Midnight's `persistentHash`), but it's good enough to give the user a stable hex string to share off-band. In production you'd want to either:

- Call the `pureCircuit` on-chain helper, which gives you the *exact* hash, or
- Reimplement the Midnight `persistentHash` in JS and use it directly.

The current dApp uses SHA-256 as a placeholder because the `pureCircuit` import is heavy and only available after compile. A real production version would do the swap.

## What's not in the dApp (yet)

I deliberately left these out to keep the demo focused:

1. **Per-share weighting.** Currently each commitment is "one share." For variable allocations you'd store a `Map<Bytes<32>, Uint<64>>` mapping commitment to share count, then weight yield claims by it.
2. **Property NFTs.** No on-chain link between a property and any external identifier. You'd add a `Map<Bytes<32>, Bytes<32>>` mapping propertyId to a property-metadata hash.
3. **Redemption / share burn.** Once issued, shares stay in the tree forever. Adding a redemption nullifier set per (investor, property) gives you partial exits.
4. **Real token settlement.** The rental pool is a `Uint<64>` accumulator, not a real shielded token balance. Plug in a shielded token for real money movement.

Any of these would make a fun PR.

## Troubleshooting from live testing

- **`Failed to resolve import "/src/contracts/managed/realestate/contract/index.js"`** — you haven't compiled the contract yet. Run `npx compact compile contracts/Contract.compact src/contracts/managed/realestate`. The frontend imports the contract at that exact path.

- **Wallet not detected** — Lace and 1AM inject `window.midnight` asynchronously. The `ConnectButton` polls for a couple of seconds after mount to pick that up. If it's still not found, the button deep-links to lace.io.

- **`Not the sponsor` on `issueShare`** — your wallet doesn't match the wallet that deployed. Switch to the deployer wallet or redeploy.

- **`Not an owner of this property` on `claimYield`** — sponsor hasn't called `issueShare` for your commitment yet, *or* you computed the commitment with a different `propertyId` than the one you're claiming on. Double-check the spelling.

- **`Yield already claimed this cycle`** — the nullifier is doing its job. Pick a different cycle ID or wait for the sponsor to declare the next one.

- **Tx hangs at "Generating proof"** — your local proof server probably died. Re-run `docker run -p 6300:6300 midnightntwrk/proof-server:8.0.3 midnight-proof-server -v`.

- **`BalanceCheckOverspend` (error 138)** — your wallet doesn't have enough tDUST to pay tx fees. Hit the Preprod faucet.

## Where to go next

- Clone the repo and try it: https://github.com/ayushsingh82/Midnight-dApps
- Extend the contract with per-share weighting (the most-requested feature).
- Read the [Midnight Compact docs](https://docs.midnight.network/) for the full circuit/witness/ledger model.
- The sister dApps in this repo — [confidential-dividend](https://github.com/ayushsingh82/Midnight-dApps/tree/main/confidential-dividend) and [confidential-asset-management](https://github.com/ayushsingh82/Midnight-dApps/tree/main/confidential-asset-management) — apply the same pattern to corporate dividends and fund management. Reading the three contracts side-by-side is the fastest way to grasp the privacy/auditability trade-offs.
