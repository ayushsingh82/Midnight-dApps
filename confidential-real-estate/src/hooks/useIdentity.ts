import { useEffect, useState } from 'react';
import { useWalletStore } from './useWallet';
import { deriveKey, deriveKeyFromPassword } from '../lib/utils';

// A wallet-derived identity. No extra password — the wallet IS the key.
// Same wallet always gives back the same investor/sponsor key. Lose the
// wallet seed phrase → lose the identity (same trust model as any wallet).

export type Role = 'investor' | 'sponsor';

const APP_SALT = 'confidential-real-estate-v1';

export function useIdentity(role: Role) {
  const { addresses, isConnected } = useWalletStore();
  const [secretKey, setSecretKey] = useState<Uint8Array | null>(null);

  useEffect(() => {
    if (!isConnected || !addresses?.shieldedCoinPublicKey) {
      setSecretKey(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const master = await deriveKeyFromPassword(APP_SALT, addresses.shieldedCoinPublicKey);
      const sk = await deriveKey(master, `realestate:${role}`);
      if (!cancelled) setSecretKey(sk);
    })();
    return () => { cancelled = true; };
  }, [isConnected, addresses?.shieldedCoinPublicKey, role]);

  return secretKey;
}

export async function deriveRoleKey(shieldedCoinPublicKey: string, role: Role): Promise<Uint8Array> {
  const master = await deriveKeyFromPassword(APP_SALT, shieldedCoinPublicKey);
  return deriveKey(master, `realestate:${role}`);
}
