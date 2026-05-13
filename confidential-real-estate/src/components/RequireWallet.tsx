import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useWalletStore } from '../hooks/useWallet';

export function RequireWallet({ children }: { children: ReactNode }) {
  const { isConnected } = useWalletStore();
  if (!isConnected) return <Navigate to="/" replace />;
  return <>{children}</>;
}
