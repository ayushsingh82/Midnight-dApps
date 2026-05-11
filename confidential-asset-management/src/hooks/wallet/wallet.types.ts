export interface WalletAddresses {
  shieldedAddress: string;
  shieldedCoinPublicKey: string;
  shieldedEncryptionPublicKey: string;
  unshieldedAddress: string;
  dustAddress: string;
}

export interface WalletBalances {
  shielded: Record<string, bigint>;
  unshielded: Record<string, bigint>;
  dust: { balance: bigint; cap: bigint };
}
