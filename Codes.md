# Midnight Error Codes Reference

Quick reference for common error codes encountered when developing the dApps in this repository. Numbered codes come from the Midnight ledger; named codes are the `assert` strings used in the Compact contracts shipped here.

> Cross-references the upstream [midnight-apps/Codes.md](https://github.com/midnight-network/midnight-apps/blob/main/Codes.md). Re-published here verbatim for offline reference.

---

## Deserialization Errors [0–49]

| Code | Type |
|------|------|
| 0 | NetworkId |
| 1 | Transaction |
| 2 | LedgerState |
| 3 | ContractAddress |
| 4 | PublicKey |
| 5 | VersionedArenaKey |
| 6 | UserAddress |
| 7 | TypedArenaKey |
| 8 | SystemTransaction |
| 9 | DustPublicKey |
| 10 | CNightGeneratesDustActionType |
| 11 | CNightGeneratesDustEvent |

---

## Serialization Errors [50–63]

| Code | Type |
|------|------|
| 50 | TransactionIdentifier |
| 51 | LedgerState |
| 52 | LedgerParameters |
| 53 | ContractAddress |
| 54 | ContractState |
| 55 | ContractStateToJson |
| 56 | ZswapState |
| 57 | UnknownType |
| 58 | MerkleTreeDigest |
| 59 | VersionedArenaKey |
| 60 | TypedArenaKey |
| 61 | CNightGeneratesDustEvent |
| 62 | SystemTransaction |
| 63 | ArenaHash |

---

## Transaction Invalid Errors

**Range 100–109:**

| Code | Error |
|------|-------|
| 100 | EffectsMismatch |
| 101 | ContractAlreadyDeployed |
| 102 | ContractNotPresent |
| 103 | Zswap(Unknown) |
| 104 | Transcript |
| 105 | InsufficientClaimable |
| 106 | VerifierKeyNotFound |
| 107 | VerifierKeyAlreadyPresent |
| 108 | ReplayCounterMismatch |
| 109 | UnknownError |

**Range 194–200:**

| Code | Error |
|------|-------|
| 194 | BalanceCheckOutOfBounds |
| 195 | InputNotInUtxos |
| 196 | DustDoubleSpend |
| 197 | DustDeregistrationNotRegistered |
| 198 | GenerationInfoAlreadyPresent |
| 199 | InvariantViolation |
| 200 | RewardTooSmall |

**Range 239–244:**

| Code | Error |
|------|-------|
| 239 | Zswap(NullifierAlreadyPresent) |
| 240 | Zswap(CommitmentAlreadyPresent) |
| 241 | Zswap(UnknownMerkleRoot) |
| 242 | ReplayProtectionViolation(IntentTtlExpired) |
| 243 | ReplayProtectionViolation(IntentTtlTooFarInFuture) |
| 244 | ReplayProtectionViolation(IntentAlreadyExists) |

**Range 248–250:**

| Code | Error |
|------|-------|
| 248 | DivideByZero |
| 249 | MerkleTreeError |
| 250 | Zswap(MerkleTreeError) |

---

## Other Errors

| Code | Error |
|------|-------|
| 150 | LedgerCacheError |
| 151 | NoLedgerState |
| 152 | LedgerStateScaleDecodingError |
| 153 | ContractCallCostError |
| 154 | BlockLimitExceededError |
| 155 | FeeCalculationError |
| 156 | ContractNotPresent |
| 157 | BeneficiaryNotFound |
| 165 | GetTransactionContextError |
| 255 | HostApiError |

---

## dApp-specific assert messages

These are the assertion strings you can hit by interacting with the contracts in this repository. The error text is exactly what the wallet surfaces in the failure popup.

### confidential-real-estate

| Assert | Meaning | Fix |
|--------|---------|-----|
| `Not the sponsor` | Caller's derived `publicKey(sk)` does not match the sealed `sponsor` | Use the same wallet + password that deployed the contract |
| `Not an owner of this property` | Caller's commitment is not in `ownershipCommitments` | Sponsor must call `issueShare` with your commitment first |
| `Yield already claimed this cycle` | Per-cycle nullifier already present | Use a different `cycle` value, or wait for the next cycle |
| `Insufficient rental pool` | `rentalPoolAvailable < amount` | Sponsor needs to `depositRent` more before claiming |

### confidential-dividend

| Assert | Meaning | Fix |
|--------|---------|-----|
| `Not the issuer` | Caller is not the deployed issuer | Use the same wallet + password used at deploy |
| `Not a registered shareholder` | Caller's commitment is not in `shareholderCommitments` | Issuer must call `registerShareholder` first |
| `Dividend already claimed this cycle` | Per-cycle nullifier already present | Wait for next cycle |
| `Insufficient dividend pool` | `dividendPool < declaredDividend` | Issuer must `topUpDividendPool` |

### confidential-asset-management

| Assert | Meaning | Fix |
|--------|---------|-----|
| `Not the fund manager` | Caller is not the deployed GP | Use the same wallet + password used at deploy |
| `Not an LP of this fund` | Caller's commitment is not in `lpCommitments` | GP must `admitLp` first |
| `Payout already claimed for this period` | Per-period nullifier already present | Wait for the next period |
| `Allocation exceeds AUM` | `aum < allocation` on redeem | Internal accounting bug — investigate before continuing |
| `Payout exceeds AUM` | `aum < amount` on `claimPayout` | LP requested more than the fund can pay |

---

## Wallet-side errors

| Error text | Cause | Fix |
|------------|-------|-----|
| `Wallet not detected` | No Midnight-compatible extension installed, or it injected late | Install Lace / 1AM, refresh, wait ~1s |
| `BalanceCheckOverspend` (138) | Wallet has insufficient tDUST | Top up tDUST via the Preprod faucet |
| `Connection failed` | User rejected the connection in the wallet popup, or wallet is locked | Unlock the wallet, retry |
| `Proof server unreachable` | Local proof server (port 6300) isn't running | `docker run -p 6300:6300 midnightntwrk/proof-server:8.0.3 midnight-proof-server -v` |
| `Failed to resolve import "/src/contracts/managed/.../contract/index.js"` | Compact contract not compiled yet | `npx compact compile contracts/Contract.compact src/contracts` |
