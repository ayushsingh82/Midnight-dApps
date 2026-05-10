import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';

export type DividendPrivateState = {
  readonly secretKey: Uint8Array;
};

export const createDividendPrivateState = (secretKey: Uint8Array): DividendPrivateState => ({ secretKey });

export const witnesses = {
  localSecretKey: ({ privateState }: WitnessContext<any, DividendPrivateState>): [DividendPrivateState, Uint8Array] => [
    privateState,
    privateState.secretKey,
  ],
  findShareholderPath: (
    { privateState, ledger }: WitnessContext<any, DividendPrivateState>,
    commit: Uint8Array,
  ) => {
    const path = ledger.shareholderCommitments.findPathForLeaf(commit);
    if (!path) throw new Error('Shareholder commitment not found in tree');
    return [privateState, path];
  },
};
