# Confidential Dividend Distribution on Midnight

> 📖 Published version: https://dev.to/ayush_singh_4525768ba4731/-tutorial-confidential-dividend-distribution-on-midnight-15e1
>
> 📁 Source: [Midnight-dApps/confidential-dividend](https://github.com/ayushsingh82/Midnight-dApps/tree/main/confidential-dividend)

A public corporate cap table is the unsolved scandal of on-chain finance. Every public company in the world reports aggregate shareholdings in 10-Q filings, but anyone who issues equity on a transparent blockchain effectively publishes positions of every holder, every insider, every family office — addressable by wallet ID forever. Half of corporate America walks away the moment you mention "on-chain."

Midnight gives you a way out. This dApp shows it.

A corporate issuer registers shareholders, tops up a dividend pool each quarter, and declares the per-share rate. Holders prove eligibility and claim with zero-knowledge proofs. Nullifiers enforce one-claim-per-cycle. Auditors and regulators see the totals; nobody sees the cap table.

The contract is ~120 lines of Compact. The frontend is one role-aware React app with three roles wired in (issuer, shareholder, observer). The whole thing runs on Midnight Preprod with the proof server hosted locally.

## Three real use cases this unlocks

1. **Late-stage private equity** — companies that want to start paying preferred-stock dividends on-chain without revealing their cap table to competitors, journalists, or the SEC EDGAR scrapers. The holders are already known to the company (registered through onboarding), so the only privacy boundary that matters is the *public* one.

2. **Tokenised co-ops and DAOs that act like co-ops** — a member-owned org that distributes annual surplus to members. You want every member to be able to verify they were paid, and the public to be able to verify the org distributed exactly what it said it would, without doxxing every member.

3. **Token-buyback and revenue-share programmes** — a protocol that programmatically distributes a share of revenue to token holders, but doesn't want the holder list public (because price-sensitive insiders are on it). Today these programmes are either centralised escrow or fully public; Midnight enables a third option.

## Prerequisites

- Node 20+
- Lace or 1AM, on Midnight Preprod
- tNIGHT + tDUST from the Preprod faucet
- Docker
- Compact compiler:

```bash
curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
```

## The contract walk-through

Full source: [contracts/Contract.compact](./contracts/Contract.compact). I'll walk through it function by function.

### Ledger state

```compact
pragma language_version 0.22;
import CompactStandardLibrary;

export sealed ledger issuer: Bytes<32>;

export ledger shareholderCommitments: HistoricMerkleTree<10, Bytes<32>>;
export ledger dividendNullifiers: Set<Bytes<32>>;

export ledger dividendPool: Uint<64>;
export ledger declaredDividend: Uint<64>;

export ledger totalShareholders: Counter;
export ledger totalDividendsPaid: Counter;
```

Five pieces of state worth knowing:

- **`issuer`** is `sealed`. That means the value can only be written once, by the constructor. Every privileged circuit checks `assert(issuer == publicKey(callerSk))`. There's no admin transfer, by design — for an MVP this is fine; in production you'd add a multi-step `transferIssuer` flow.

- **`shareholderCommitments`** is a depth-10 historic Merkle tree. "Historic" means proofs against older roots stay valid. So a shareholder who got registered 200 blocks ago can still prove they're a holder today.

- **`dividendNullifiers`** is the anti-double-claim set. A nullifier is `H(shareholderSk, classId, cycle)`. Two claims with the same triple produce the same nullifier; the second one gets rejected.

- **`dividendPool`** is a public scalar. Anyone observing the contract knows exactly how much treasury is available.

- **`declaredDividend`** is the per-share rate for the *current* cycle. Issuers update this each quarter via `declareCycleDividend`.

I deliberately kept it to a single share class. Adding multi-class support is straight-forward — you'd replace the Merkle tree and counters with a `Map<Bytes<32>, ...>` keyed by classId.

### Witnesses

```compact
witness localSecretKey(): Bytes<32>;
witness findShareholderPath(commit: Bytes<32>): MerkleTreePath<10, Bytes<32>>;
```

Two witnesses. `localSecretKey()` fetches the caller's private key from off-chain state. `findShareholderPath()` finds the Merkle path from the caller's commitment to a root the tree has historically had.

The TypeScript side that resolves these:

```ts
export const witnesses = {
  localSecretKey: ({ privateState }) => [privateState, privateState.secretKey],
  findShareholderPath: ({ privateState, ledger }, commit) => {
    const path = ledger.shareholderCommitments.findPathForLeaf(commit);
    if (!path) throw new Error('Shareholder commitment not found in tree');
    return [privateState, path];
  },
};
```

The Midnight runtime hands these to Compact during proof generation. The path goes into the ZK proof; the chain only ever sees the resulting root assertion.

### Constructor

```compact
constructor(issuerSk: Bytes<32>) {
    issuer = disclose(publicKey(issuerSk));
}

circuit publicKey(sk: Bytes<32>): Bytes<32> {
    return persistentHash<Vector<2, Bytes<32>>>(
        [pad(32, "dividend:pk:v1"), sk]
    );
}
```

The deployer's secret key is passed in as a witness argument. We compute its public key (domain-separated with `"dividend:pk:v1"` so it doesn't collide with public keys in other dApps) and seal it. Nothing else is needed at deploy time.

### `getShareholderCommitment(sk, classId)` — off-chain helper

```compact
circuit shareholderCommit(sk: Bytes<32>, classId: Bytes<32>): Bytes<32> {
    return persistentHash<Vector<3, Bytes<32>>>(
        [pad(32, "dividend:sh:v1"), classId, sk]
    );
}

export circuit getShareholderCommitment(sk: Bytes<32>, classId: Bytes<32>): Bytes<32> {
    return shareholderCommit(sk, classId);
}
```

`shareholderCommit` is what makes the privacy model work. A shareholder's commitment is `H(domain, classId, sk)`. Three properties matter:

1. **Deterministic.** Same wallet + same class → same commitment forever.
2. **One-way.** Even if the issuer leaks the entire tree, you can't reverse a commitment back to a wallet.
3. **Domain-separated.** The `"dividend:sh:v1"` padding ensures the same secret in a different dApp produces a different commitment.

`getShareholderCommitment` is the `export` wrapper, callable from the frontend as a pure circuit (no on-chain tx, just hash computation in JS).

### `registerShareholder(commit)` — issuer only

```compact
export circuit registerShareholder(shareholderCommitArg: Bytes<32>): [] {
    const sk = localSecretKey();
    assert(issuer == disclose(publicKey(sk)), "Not the issuer");
    shareholderCommitments.insert(disclose(shareholderCommitArg));
    totalShareholders.increment(1);
}
```

The shareholder hands the issuer a commitment off-chain (Slack DM, KYC portal, anywhere). The issuer calls `registerShareholder` with it. The chain's only new fact: a leaf was added to the tree. The chain still doesn't know whose.

The `disclose(publicKey(sk))` call is interesting — it computes the public key inside the circuit and crosses the public-private boundary. Without `disclose`, the compiler rejects the equality check.

### `topUpDividendPool(amount)` — issuer only

```compact
export circuit topUpDividendPool(amount: Uint<64>): [] {
    const sk = localSecretKey();
    assert(issuer == disclose(publicKey(sk)), "Not the issuer");
    dividendPool = (dividendPool + amount) as Uint<64>;
}
```

Bumps the public pool counter. The `as Uint<64>` cast is needed because Compact requires explicit width annotations on arithmetic that might overflow.

In a real system you'd probably swap this for a circuit that accepts a shielded coin commitment and deposits actual tNIGHT into the contract. The accountant simplification here is for clarity.

### `declareCycleDividend(amount)` — issuer only

```compact
export circuit declareCycleDividend(amount: Uint<64>): [] {
    const sk = localSecretKey();
    assert(issuer == disclose(publicKey(sk)), "Not the issuer");
    declaredDividend = amount;
}
```

Sets the per-share dividend for the upcoming cycle. Public. Every shareholder watching the contract knows what they can claim next.

There's no `cycle` argument here intentionally — the cycle is derived implicitly from the nullifier on the claim side. If you want a richer model you can declare per-cycle by adding a `Map<Bytes<32>, Uint<64>>`.

### `claimDividend(classId, cycle)` — shareholder

```compact
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

This is the heart of the dApp. Four assertions in sequence:

1. The shareholder's commitment is in the Merkle tree. (`checkRoot` on a historic root.)
2. The nullifier for `(sk, classId, cycle)` hasn't been seen. This is what blocks the same shareholder from claiming twice in the same cycle.
3. The pool can cover the declared per-share amount.

If all three pass, we insert the nullifier, decrement the pool by the declared amount, and bump the public payout counter.

Notice the cycle is opaque bytes — the contract doesn't care if it's `"2026-Q2"`, an ISO date, or a UNIX timestamp. The issuer just needs to keep using fresh values. Reusing a cycle ID is allowed, but it means each shareholder can only claim once across the cycle's lifetime.

Why does the chain learn the *amount* but not the *recipient*? Because we deduct from a public pool — the deduction has to be public for solvency. The recipient stays private because the proof verifies "some commitment in the tree" not "this particular commitment."

### `proveEligibility(classId)` — shareholder, no-claim variant

```compact
export circuit proveEligibility(classId: Bytes<32>): Boolean {
    const sk = localSecretKey();
    const commit = shareholderCommit(sk, classId);
    const path = findShareholderPath(commit);
    assert(
        shareholderCommitments.checkRoot(disclose(merkleTreePathRoot<10, Bytes<32>>(path))),
        "Not a registered shareholder"
    );
    return disclose(true);
}
```

Same inclusion proof, but doesn't claim or touch the nullifier set. Useful for shareholder portals that want to gate features behind "are you a holder?" without burning a cycle.

You can build authentication flows on top of this — the dApp authenticates "yes, this caller is a holder of class X" without any password, OAuth, or off-chain database.

### `dividendNullifier(sk, classId, cycle)` — private helper

```compact
circuit dividendNullifier(sk: Bytes<32>, classId: Bytes<32>, cycle: Bytes<32>): Bytes<32> {
    return persistentHash<Vector<4, Bytes<32>>>(
        [pad(32, "dividend:nul:v1"), classId, cycle, sk]
    );
}
```

Four inputs into the hash: domain, classId, cycle, secret. Each new cycle changes the hash; each shareholder produces a different one. The result is the exact byte string the `Set` insertion checks against.

## The frontend, by page

The router has four protected pages and one Home page:

```ts
<Routes>
  <Route path="/"         element={<HomePage />} />
  <Route path="/deploy"   element={<RequireWallet><DeployPage /></RequireWallet>} />
  <Route path="/register" element={<RequireWallet><RegisterPage /></RequireWallet>} />
  <Route path="/declare"  element={<RequireWallet><DeclarePage /></RequireWallet>} />
  <Route path="/claim"    element={<RequireWallet><ClaimPage /></RequireWallet>} />
</Routes>
```

`RequireWallet` redirects to `/` if `isConnected` is false on the Zustand store. Means you can't deep-link into Deploy without a wallet attached.

### Wallet detection edge case

This one bit me. Lace and 1AM inject `window.midnight` *after* the React app mounts. If you read `window.midnight` once on mount, you'll miss late injections.

The fix is to poll for the first few seconds:

```ts
useEffect(() => {
  let attempts = 0;
  const id = window.setInterval(() => {
    const found = getCompatibleWallets();
    setWallets((prev) => (found.length !== prev.length ? found : prev));
    attempts += 1;
    if (attempts >= 10 || found.length > 0) window.clearInterval(id);
  }, 300);
  return () => window.clearInterval(id);
}, []);
```

Polls every 300ms for up to 3s. If a wallet shows up, we stop. If not, the "Install wallet" button shows up and deep-links to lace.io.

### Deriving the role key

A single helper does the wallet → role key derivation:

```ts
const APP_SALT = 'confidential-dividend-v1';

export async function deriveRoleKey(shieldedCoinPublicKey, role) {
  const master = await deriveKeyFromPassword(APP_SALT, shieldedCoinPublicKey);
  return deriveKey(master, `dividend:${role}`);
}
```

Roles are `'shareholder'` or `'issuer'`. Same wallet = same role key forever, and an issuer using their issuer key can't accidentally act as a shareholder (different domain separator on the same wallet seed).

### Submitting a circuit call

Every action page follows roughly the same pattern (Deploy/Register/Declare/Claim):

```ts
const providers = await buildProviders({
  connectedApi,
  shieldedCoinPublicKey: addresses.shieldedCoinPublicKey,
  shieldedEncryptionPublicKey: addresses.shieldedEncryptionPublicKey,
  privateStateStoreName: 'dividend',
});
const { finalContract } = await loadCompiledContract();
const { findDeployedContract, createCircuitCallTxInterface } =
  await import('@midnight-ntwrk/midnight-js-contracts');

await findDeployedContract(providers, {
  contractAddress,
  compiledContract: finalContract,
  privateStateId: PRIVATE_STATE_ID,
  initialPrivateState: createDividendPrivateState(issuerSk),
});

const txInterface = createCircuitCallTxInterface(
  providers, finalContract, contractAddress, PRIVATE_STATE_ID,
);
await txInterface.registerShareholder(hexToUint8Array(holderCommit));
```

The `lazy import` of `@midnight-ntwrk/midnight-js-contracts` keeps the initial bundle small — the contracts library is heavy and not needed until a user actually submits a transaction.

`buildProviders` lives in `src/lib/midnight.ts` and wires up six things (private-state level DB, indexer provider, ZK config, proof server, wallet adapter, midnight adapter). Centralising it means the page files stay focused on the UI.

## Reading aggregate state

The Home page reads stats from the indexer:

```ts
const provider = indexerPublicDataProvider(INDEXER_HTTP, INDEXER_WS);
const state = await provider.queryContractState(contractAddress);
const contractModule = await import('/src/contracts/managed/dividend/contract/index.js');
const ledger = contractModule.ledger(state.data);

// ledger.totalShareholders     → bigint
// ledger.totalDividendsPaid    → bigint
// ledger.dividendPool          → bigint
// ledger.declaredDividend      → bigint
```

`indexerPublicDataProvider` wraps an Apollo client around `indexer.preprod.midnight.network/api/v4/graphql`. Calling `queryContractState` gives you raw `ContractState`; passing it through `contractModule.ledger()` deserialises it into typed fields.

For a production dashboard you'd usually layer an Express + Postgres cache in front of the indexer (the pattern from the [upstream fullstack-dapp tutorial](https://github.com/midnight-network/midnight-apps/blob/main/fullstack-dapp/tutorial.md)). Otherwise every page load hits the indexer.

## Auditor view

An auditor or regulator with the contract address can verify, in zero knowledge but with full confidence:

- That every payout consumed exactly `declaredDividend` from the pool
- That no nullifier appears twice
- That every claim came from a commitment in the tree
- The exact number of shareholders, total payouts, and pool balance

What they cannot see:

- Which wallet maps to which commitment
- Any individual shareholder's claim count over time
- Any link between two different dividend cycles for the same shareholder (because the nullifier hash is different each cycle)

This is the trade-off in one paragraph. The chain proves process integrity; the cap table stays off-chain.

## What I'd build on top

Three concrete extensions:

1. **Multi-class** — replace the single tree with `Map<Bytes<32>, HistoricMerkleTree<10, Bytes<32>>>` keyed by classId. Different rates per class, same nullifier scheme.

2. **Real settlement** — pair with a [shielded token](https://github.com/midnight-network/midnight-apps/tree/main/shielded-token). On `claimDividend`, mint a coin commitment to a fresh recipient address.

3. **Time-locked declarations** — the issuer commits to a future dividend rate cryptographically before the record date, and reveals it on schedule. Useful for compliance frameworks that require advance notice.

## Troubleshooting

- **Vite throws "Failed to resolve import .../dividend/contract/index.js"** — compile the contract first. The right command is `npx compact compile contracts/Contract.compact src/contracts/managed/dividend`. The path matters — the frontend imports from exactly that location.

- **`Not the issuer` on `topUpDividendPool`** — you're calling from a wallet that wasn't the deployer. Switch wallets or redeploy.

- **`Not a registered shareholder` on `claimDividend`** — issuer hasn't called `registerShareholder` for your commitment yet. Verify the issuer's logs show the registration tx succeeded, and that you computed the commitment with the same classId you're now claiming on.

- **`Dividend already claimed this cycle`** — pick a fresh cycle ID, or wait for the issuer to declare a new one.

- **`Insufficient dividend pool`** — issuer needs to `topUpDividendPool` before the next batch of claims. The contract correctly rejects payouts that would overdraw.

- **WebSocket disconnects during proof generation** — the proof server can take 30+ seconds for first-time circuit proving. Don't refresh the page. If it really dies, the wallet shows "Connection failed" and you can retry.

- **Transactions stuck "pending"** — Midnight Preprod blocks are roughly every 6 seconds. If it's been more than 30 seconds, check explorer.1am.xyz for the tx hash. If it's not there, it never got submitted — usually means your wallet was out of tDUST.

## Repo and next steps

- Code: https://github.com/ayushsingh82/Midnight-dApps/tree/main/confidential-dividend
- Companion dApps in the same repo: [real-estate](https://github.com/ayushsingh82/Midnight-dApps/tree/main/confidential-real-estate) and [asset-management](https://github.com/ayushsingh82/Midnight-dApps/tree/main/confidential-asset-management). The three contracts share a privacy primitive but tune the public/private split differently — worth reading back to back.
- Compact language reference: https://docs.midnight.network/

If you fork it and ship something interesting, I'd love to hear about it.
