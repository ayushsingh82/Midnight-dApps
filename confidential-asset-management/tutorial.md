# Confidential Asset Management on Midnight

> 📖 Published version: https://dev.to/ayush_singh_4525768ba4731/-tutorial-confidential-asset-management-on-midnight-2hmb
>
> 📁 Source: [Midnight-dApps/confidential-asset-management](https://github.com/ayushsingh82/Midnight-dApps/tree/main/confidential-asset-management)

The TradFi-to-DeFi pipeline has been stuck on one specific question for half a decade: how do you give LPs the programmability and speed of public chains without doxxing the entire allocator book and giving away the GP's edge?

Tribute, Enzyme, dHedge, and every other on-chain fund I've looked at has the same gap. They publish the cap table, they publish the holdings, and increasingly they publish the strategy. That's fine for retail trying their luck with $100. It's a deal-breaker for a real $100M fund.

Midnight is the first chain where this trade-off actually splits the right way. AUM can be public. ROI can be public. Per-LP allocations stay private. Strategy stays off-chain. Auditors get verifiable counter values; LPs get the privacy they need to participate.

This dApp is a working demonstrator of that model. ~120 lines of Compact, ~600 lines of React, four roles wired in (GP, LP, auditor, observer). I'll walk through the contract piece by piece, then the frontend, then what's missing for production.

## Use cases this could actually serve

1. **Family-office managed funds** — single-family offices pool capital across cousins, in-laws, and siblings. Today these are private LP agreements with annual paper statements. Move them on-chain on Midnight and you keep the privacy from outsiders, give every family branch independent verifiability of pool performance, and settle distributions same-day instead of quarterly.

2. **Crypto-native hedge funds with TradFi LPs** — a quant fund that takes capital from both crypto-native LPs and traditional allocators. The crypto LPs want on-chain transparency; the TradFi LPs require a privacy guarantee before they'll allocate. Today the fund has to pick one. With this contract, both can sit in the same vehicle.

3. **Tokenised emerging-markets credit funds** — high-yield credit funds where the LP list itself is sensitive (sanctions exposure, reputation, jurisdictional issues). Aggregate AUM and yield can be public so the protocol stays auditable; per-LP positions are commitments in a Merkle tree.

## Prerequisites

- Node 20+
- Lace or 1AM, on Midnight Preprod
- tNIGHT + tDUST from the Preprod faucet
- Docker
- The Compact compiler

```bash
curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
```

## Privacy/auditability — where the line sits

The interesting design decision in this dApp is *which* fields are public versus private. There's no single right answer; it depends on what the regulator needs to see, what the LPs want hidden, and what the GP needs to keep secret.

Here's how I drew the lines:

| Field | Public? | Why |
|-------|---------|-----|
| `manager` | Yes | Sealed at deploy; identifies who can act as GP |
| LP commitments | Tree only | Chain sees leaves, never wallets |
| LP allocation amount | **Public** | Added to `aum`; the chain needs to verify solvency |
| `aum` | Yes | Public AUM for compliance and LP comfort |
| `reportedRoiBp` | Yes | LP and regulator verifiability of performance |
| Per-LP holdings ratio | Off-chain | GP keeps these books |
| Strategy | Off-chain | The GP's edge |
| Payout amounts | Public | Solvency requires it |
| Payout recipients | Private | Same pattern as the dividend dApp |

That last row is the key insight: the chain learns "an LP claimed 60,000 for period 2026-05" without learning which LP. The trade is "amount public, identity private" — the opposite of most on-chain funds today.

This is the *opposite* trade-off of every existing on-chain fund product. Tribute, Enzyme, et al. leak per-wallet holdings on a public chain. Off-chain funds leak nothing on-chain. Midnight finds the third option.

## The contract

Full source: [contracts/Contract.compact](./contracts/Contract.compact).

### Ledger state

```compact
pragma language_version 0.22;
import CompactStandardLibrary;

export sealed ledger manager: Bytes<32>;

export ledger lpCommitments: HistoricMerkleTree<10, Bytes<32>>;
export ledger payoutNullifiers: Set<Bytes<32>>;

export ledger aum: Uint<64>;
export ledger reportedRoiBp: Uint<64>;

export ledger totalLps: Counter;
export ledger totalPayouts: Counter;
```

The ledger has six pieces of state:

- **`manager`** is the GP's public key, sealed at deploy. Every privileged circuit checks `manager == publicKey(callerSk)`. There is no admin handover circuit — for a production system you'd add a two-step `proposeNewManager` + `acceptManager` flow with a time-lock.

- **`lpCommitments`** is the LP cap table. Each leaf is `H(lpSk, fundId)`. Depth 10 supports up to 1024 LPs, which is fine for any real fund (most institutional funds cap out at 200–300 LPs by SEC rules anyway).

- **`payoutNullifiers`** is the anti-double-claim set. A nullifier is `H(lpSk, fundId, period)`. Two claims with the same triple produce the same nullifier; the second one bounces.

- **`aum`** is the public assets-under-management counter. Both `admitLp` (which increments) and `redeemLp` / `claimPayout` (which decrement) touch it.

- **`reportedRoiBp`** is the per-period ROI in basis points. 1200 = +12.00%. Public so LPs can verify the GP is reporting what they claim, and so external observers can rank the fund's performance.

- The two counters are public dashboard fodder.

### Witnesses

```compact
witness localSecretKey(): Bytes<32>;
witness findLpPath(commit: Bytes<32>): MerkleTreePath<10, Bytes<32>>;
```

Same pattern as the other two dApps in this repo: one witness for the caller's secret, one for the Merkle path. The TypeScript side that resolves them:

```ts
export const witnesses = {
  localSecretKey: ({ privateState }) => [privateState, privateState.secretKey],
  findLpPath: ({ privateState, ledger }, commit) => {
    const path = ledger.lpCommitments.findPathForLeaf(commit);
    if (!path) throw new Error('LP commitment not found in tree');
    return [privateState, path];
  },
};
```

The Midnight runtime calls these during proof generation. The path becomes part of the ZK proof; the chain only verifies the resulting root match.

### Constructor

```compact
constructor(managerSk: Bytes<32>) {
    manager = disclose(publicKey(managerSk));
}

circuit publicKey(sk: Bytes<32>): Bytes<32> {
    return persistentHash<Vector<2, Bytes<32>>>(
        [pad(32, "fund:pk:v1"), sk]
    );
}
```

The deployer passes their secret key as a witness argument. We hash it (domain-separated with `"fund:pk:v1"` so it doesn't collide with public keys in other Midnight dApps using the same wallet) and seal the result into `manager`.

### `getLpCommitment(sk, fundId)` — off-chain helper

```compact
circuit lpCommit(sk: Bytes<32>, fundId: Bytes<32>): Bytes<32> {
    return persistentHash<Vector<3, Bytes<32>>>(
        [pad(32, "fund:lp:v1"), fundId, sk]
    );
}

export circuit getLpCommitment(sk: Bytes<32>, fundId: Bytes<32>): Bytes<32> {
    return lpCommit(sk, fundId);
}
```

`lpCommit` is the private helper. `getLpCommitment` is the public wrapper the frontend can call as a pure circuit — no on-chain tx, just a hash.

The same wallet always produces the same commitment for a given fund, which is what makes "lose your wallet seed, lose your LP identity" the security model. Same wallet across two funds produces *different* commitments because `fundId` is part of the hash, which is exactly what you want.

### `admitLp(commit, allocation)` — GP only

```compact
export circuit admitLp(holderCommit: Bytes<32>, allocation: Uint<64>): [] {
    const sk = localSecretKey();
    assert(manager == disclose(publicKey(sk)), "Not the fund manager");
    lpCommitments.insert(disclose(holderCommit));
    aum = (aum + allocation) as Uint<64>;
    totalLps.increment(1);
}
```

The GP onboards an LP by inserting their commitment and bumping the AUM. Three observations:

1. **The allocation is `disclose`d** — it has to be, because we add it to the public `aum`. If we tried to keep allocations private, the AUM counter wouldn't be credible (the GP could lie about the sum).

2. **The chain learns the allocation but not who.** It's "5 million was added by an LP whose commitment is somewhere in the new tree." Nobody can tell which leaf is the 5M vs the 50M.

3. **The off-chain bookkeeping** is on the GP. They need to remember "commitment X is worth 5M, commitment Y is worth 50M" so they can compute payouts correctly. The contract has no way of enforcing that — it trusts the GP on per-LP weighting.

This is a deliberate trade-off. Putting per-LP allocations on-chain (even as commitments) would either reveal them or require a full SNARK over the sum, which gets expensive at scale.

### `reportRoi(roiBp)` — GP only

```compact
export circuit reportRoi(roiBp: Uint<64>): [] {
    const sk = localSecretKey();
    assert(manager == disclose(publicKey(sk)), "Not the fund manager");
    reportedRoiBp = roiBp;
}
```

Sets the public ROI in basis points. 1200 = +12.00%. Anyone can read this off the indexer.

The contract doesn't verify the ROI matches the AUM movement — that's by design. In a real fund, the GP signs off on a quarterly NAV from an admin (State Street, Northern Trust, et al.), and the on-chain ROI is the externally-attested number. You could build a full audit-chain on top (require a quarterly hash of the admin's report), but that's outside the MVP.

### `redeemLp(commit, allocation)` — GP only

```compact
export circuit redeemLp(holderCommit: Bytes<32>, allocation: Uint<64>): [] {
    const sk = localSecretKey();
    assert(manager == disclose(publicKey(sk)), "Not the fund manager");
    assert(aum >= allocation, "Allocation exceeds AUM");
    aum = (aum - allocation) as Uint<64>;
}
```

The GP can process an LP exit. Note we do *not* remove the commitment from the historic Merkle tree — that's because proofs against older roots are still valid in Compact's `HistoricMerkleTree`, so removing leaves would break already-issued proofs.

For a real partial-redemption flow you'd pair this with a per-LP redemption nullifier set, so the same LP can only redeem once per cycle.

### `proveLp(fundId)` — LP, no-claim variant

```compact
export circuit proveLp(fundId: Bytes<32>): Boolean {
    const sk = localSecretKey();
    const commit = lpCommit(sk, fundId);
    const path = findLpPath(commit);
    assert(
        lpCommitments.checkRoot(disclose(merkleTreePathRoot<10, Bytes<32>>(path))),
        "Not an LP of this fund"
    );
    return disclose(true);
}
```

A standalone "I'm an LP of this fund" proof, no payout side-effect. Useful for:

- LP-only Discord channels that gate access on this proof
- Compliance attestations ("I am a qualified investor in fund X")
- Authentication flows that don't want passwords

The chain sees one tx; an observer learns "some LP of this fund authenticated." No way to map back to the wallet.

### `claimPayout(fundId, period, amount)` — LP

```compact
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

This is the core LP action. Steps:

1. Recompute the LP's commitment.
2. Ask the witness for the Merkle path.
3. Assert the path roots to a tree the contract has historically had.
4. Compute the nullifier for `(sk, fundId, period)` and assert it hasn't been used.
5. Assert solvency — the AUM has to be large enough for the requested amount.
6. Side effects: insert the nullifier, deduct from AUM, bump payout counter.

The LP supplies `amount` themselves. They compute it off-chain by multiplying their *private* allocation by the *public* ROI. The contract doesn't enforce that the math is correct — it only checks solvency. In a real system you'd either:

- Have the GP submit per-LP payouts (slower, more centralised)
- Use a more sophisticated SNARK that proves `amount == allocation * (1 + roi)` without revealing `allocation`

Both have engineering cost. The MVP trusts the LP to compute their payout honestly, which works fine for small consortiums and breaks down for adversarial LPs in larger funds.

### `payoutNullifier(sk, fundId, period)` — private helper

```compact
circuit payoutNullifier(sk: Bytes<32>, fundId: Bytes<32>, period: Bytes<32>): Bytes<32> {
    return persistentHash<Vector<4, Bytes<32>>>(
        [pad(32, "fund:nul:v1"), fundId, period, sk]
    );
}
```

Four inputs in the hash: domain, fundId, period, secret. Different period → different nullifier → fresh claim allowed. Same period → same nullifier → claim rejected. The same LP can claim across funds without any cross-fund linkage because `fundId` is in the hash.

## Frontend wiring

Same structural pattern as the other two dApps in this repo. The router has four protected routes:

```ts
<Routes>
  <Route path="/"       element={<HomePage />} />
  <Route path="/deploy" element={<RequireWallet><DeployPage /></RequireWallet>} />
  <Route path="/admit"  element={<RequireWallet><AdmitPage /></RequireWallet>} />
  <Route path="/report" element={<RequireWallet><ReportPage /></RequireWallet>} />
  <Route path="/payout" element={<RequireWallet><PayoutPage /></RequireWallet>} />
</Routes>
```

`RequireWallet` redirects to `/` if the wallet isn't attached. No deep-linking around the wallet gate.

### Wallet → role key

```ts
const APP_SALT = 'confidential-asset-management-v1';

export async function deriveRoleKey(shieldedCoinPublicKey, role) {
  const master = await deriveKeyFromPassword(APP_SALT, shieldedCoinPublicKey);
  return deriveKey(master, `fund:${role}`);
}
```

Roles are `'lp'` and `'manager'`. The same wallet can act as both a GP of fund A and an LP of fund B — they get different role keys, derived deterministically from the same wallet seed. This is exactly what a family office that runs its own fund *and* allocates to others would need.

### The provider bundle

`src/lib/midnight.ts` centralises the providers so the page files don't repeat themselves:

```ts
export async function buildProviders(opts) {
  const zkConfig = new FetchZkConfigProvider(`${CONTRACT_PATH}/managed/fund/keys`, fetch.bind(window));
  return {
    privateStateProvider: levelPrivateStateProvider({ privateStateStoreName: opts.privateStateStoreName }),
    publicDataProvider:   indexerPublicDataProvider(INDEXER_HTTP, INDEXER_WS),
    zkConfigProvider:     zkConfig,
    proofProvider:        httpClientProofProvider(PROOF_SERVER, zkConfig),
    walletProvider:       { /* getCoinPublicKey, balanceTx adapter */ },
    midnightProvider:     { /* submitTx adapter */ },
  };
}

export async function loadCompiledContract() {
  const contractPath = CONTRACT_PATH + '/managed/fund' + '/contract/index.js';
  const contractModule = await import(/* @vite-ignore */ contractPath);
  const cc = CompiledContract.make('fund', contractModule.Contract);
  const ccW = CompiledContract.withWitnesses(cc, witnesses);
  return {
    contractModule,
    finalContract: CompiledContract.withCompiledFileAssets(ccW, `${CONTRACT_PATH}/managed/fund`),
  };
}
```

The string-concat for `contractPath` is on purpose — Vite 8's static import-analysis tries to resolve template literals at build time, which fails if the contract isn't compiled yet. String concatenation defeats that analysis and lets the import resolve at runtime. Same approach the upstream `midnight-apps/fullstack-dapp` uses.

### Submitting a circuit call

Every action page (Admit, Report, Payout, Deploy) follows the same shape:

```ts
const providers = await buildProviders({ /* ... */ });
const { finalContract } = await loadCompiledContract();
const { findDeployedContract, createCircuitCallTxInterface } =
  await import('@midnight-ntwrk/midnight-js-contracts');

await findDeployedContract(providers, {
  contractAddress,
  compiledContract: finalContract,
  privateStateId: PRIVATE_STATE_ID,
  initialPrivateState: createFundPrivateState(managerSk),
});

const txInterface = createCircuitCallTxInterface(
  providers, finalContract, contractAddress, PRIVATE_STATE_ID,
);

await txInterface.admitLp(hexToUint8Array(holderCommit), BigInt(allocation));
```

The lazy import of `@midnight-ntwrk/midnight-js-contracts` is significant — it's a ~1MB chunk and we don't need it until the user hits "Submit." Lazy-loading shaves the initial page-load by a few hundred ms.

## Reading aggregate state

The Home page pulls the live AUM, ROI, LP count, and payout count straight from the indexer:

```ts
const provider = indexerPublicDataProvider(INDEXER_HTTP, INDEXER_WS);
const state = await provider.queryContractState(contractAddress);
const contractModule = await import('/src/contracts/managed/fund/contract/index.js');
const ledger = contractModule.ledger(state.data);

// ledger.totalLps         → bigint
// ledger.aum              → bigint
// ledger.reportedRoiBp    → bigint
// ledger.totalPayouts     → bigint
```

For a production fund-admin dashboard you'd want an Express + Postgres polling cache in front of the indexer. The pattern is documented in the [upstream fullstack-dapp tutorial](https://github.com/midnight-network/midnight-apps/blob/main/fullstack-dapp/tutorial.md). For an MVP, querying the indexer directly on page load is fine.

## What an auditor sees

A regulator or LP auditor with the contract address gets:

- `manager = 0x...` (sealed GP key)
- `totalLps = 14`
- `totalPayouts = 13`
- `aum = 67_250_000`
- `reportedRoiBp = 1200` (i.e. +12.00%)

From these they can verify:

- Every payout consumed exactly the declared amount from AUM
- No nullifier was reused
- Every claim came from a commitment in the tree
- The number of LPs match the number of `admitLp` transactions in the indexer history

What they cannot see:

- Which wallet owns which commitment
- Per-LP allocation amounts (those exist only in the GP's books)
- The fund's strategy or holdings
- Any cross-period linkage of an individual LP's claims (different period → different nullifier hash)

This is the trade-off the dApp embodies in one paragraph. The chain proves process integrity and solvency; identities and strategies stay off the chain entirely.

## Production extensions worth building

- **Per-LP allocation commitments.** Replace the disclosed `allocation` with a Pedersen commitment, and have the AUM accumulate commitments rather than scalars. More private, much more expensive in ZK proving time.

- **Time-locked GP transfer.** Two-step `proposeNewManager` + `acceptManager` with a `block_height + 100` delay. Catches the "GP key compromised" case.

- **Performance fees with high-water mark.** Have the GP commit to a high-water mark, and reject performance-fee claims if the current period's ROI doesn't exceed it. Useful for hedge-fund style 2-and-20 fee structures.

- **Multi-fund routing.** Replace `manager: Bytes<32>` with `Map<Bytes<32>, Bytes<32>>` keyed by fundId. One deployed contract hosts many funds, each with its own manager.

- **Real settlement.** Pair with a [shielded token](https://github.com/midnight-network/midnight-apps/tree/main/shielded-token) so payouts mint actual coin commitments to fresh recipient addresses, instead of just decrementing a counter.

## Troubleshooting

- **Vite throws "Failed to resolve import .../fund/contract/index.js"** — you haven't compiled. Run `npx compact compile contracts/Contract.compact src/contracts/managed/fund`. The path matters: the frontend imports from exactly there.

- **`Not the fund manager` on `admitLp` / `reportRoi`** — your wallet is not the one that deployed. Switch wallets or redeploy.

- **`Not an LP of this fund` on `claimPayout`** — the GP hasn't called `admitLp` for your commitment yet, *or* you computed the commitment with a different fundId. Double-check the fundId you're claiming on matches exactly what was used at admit time.

- **`Payout already claimed for this period`** — the nullifier is working. Move to the next period or wait for the GP to declare a new one.

- **`Payout exceeds AUM`** — either the LP is claiming more than the fund can pay, or the GP hasn't admitted enough capital to cover this period's payouts. Recheck the math.

- **Proof generation hangs** — your local proof server died. Restart with `docker run -p 6300:6300 midnightntwrk/proof-server:8.0.3 midnight-proof-server -v`. First proofs after a server restart can take 30–60 seconds.

- **Wallet not detected** — Lace and 1AM inject `window.midnight` asynchronously. The `ConnectButton` polls for up to 3 seconds. If still nothing, the button deep-links to lace.io.

- **`BalanceCheckOverspend` (error 138)** — you're out of tDUST. Hit the Preprod faucet.

## Repo and next steps

- Code: https://github.com/ayushsingh82/Midnight-dApps/tree/main/confidential-asset-management
- Companion dApps in the same repo: [real-estate](https://github.com/ayushsingh82/Midnight-dApps/tree/main/confidential-real-estate) and [dividend](https://github.com/ayushsingh82/Midnight-dApps/tree/main/confidential-dividend). The three Compact contracts share the same building blocks — Merkle tree + nullifier set + sealed authority key — but tune the public/private split for different use cases. Reading the three back to back is the fastest way to internalise the design space.
- Compact language reference: https://docs.midnight.network/
- The upstream [`midnight-apps/fullstack-dapp`](https://github.com/midnight-network/midnight-apps/tree/main/fullstack-dapp) is the reference implementation this dApp is modelled after.
