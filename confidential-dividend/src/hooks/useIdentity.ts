import { useEffect, useState } from 'react';
import { useWalletStore } from './useWallet';
import { deriveKey, deriveKeyFromPassword } from '../lib/utils';

export type Role = 'shareholder' | 'issuer';

const APP_SALT = 'confidential-dividend-v1';

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
      const sk = await deriveKey(master, `dividend:${role}`);
      if (!cancelled) setSecretKey(sk);
    })();
    return () => { cancelled = true; };
  }, [isConnected, addresses?.shieldedCoinPublicKey, role]);

  return secretKey;
}

export async function deriveRoleKey(shieldedCoinPublicKey: string, role: Role): Promise<Uint8Array> {
  const master = await deriveKeyFromPassword(APP_SALT, shieldedCoinPublicKey);
  return deriveKey(master, `dividend:${role}`);
}
