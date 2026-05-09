import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';

export type RealEstatePrivateState = {
  readonly secretKey: Uint8Array;
};

export const createRealEstatePrivateState = (secretKey: Uint8Array): RealEstatePrivateState => ({ secretKey });

export const witnesses = {
  localSecretKey: ({ privateState }: WitnessContext<any, RealEstatePrivateState>): [RealEstatePrivateState, Uint8Array] => [
    privateState,
    privateState.secretKey,
  ],
  findOwnershipPath: (
    { privateState, ledger }: WitnessContext<any, RealEstatePrivateState>,
    commit: Uint8Array,
  ) => {
    const path = ledger.ownershipCommitments.findPathForLeaf(commit);
    if (!path) throw new Error('Ownership commitment not found in tree');
    return [privateState, path];
  },
};
