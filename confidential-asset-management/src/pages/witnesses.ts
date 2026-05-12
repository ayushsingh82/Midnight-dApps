import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';

export type FundPrivateState = {
  readonly secretKey: Uint8Array;
};

export const createFundPrivateState = (secretKey: Uint8Array): FundPrivateState => ({ secretKey });

export const witnesses = {
  localSecretKey: ({ privateState }: WitnessContext<any, FundPrivateState>): [FundPrivateState, Uint8Array] => [
    privateState,
    privateState.secretKey,
  ],
  findLpPath: (
    { privateState, ledger }: WitnessContext<any, FundPrivateState>,
    commit: Uint8Array,
  ) => {
    const path = ledger.lpCommitments.findPathForLeaf(commit);
    if (!path) throw new Error('LP commitment not found in tree');
    return [privateState, path];
  },
};
