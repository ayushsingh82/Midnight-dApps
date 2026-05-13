import { useEffect, useState } from 'react';
import { Button } from './Button';
import { WalletSelectModal } from './WalletSelectModal';
import { useWalletStore, getCompatibleWallets } from '../../hooks/useWallet';
import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';

function formatAddress(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}

export function ConnectButton() {
  const { isConnected, isConnecting, connect, setWallet, addresses, setShowAccountModal, error } = useWalletStore();
  const [wallets, setWallets] = useState<InitialAPI[]>(() => getCompatibleWallets());
  const [showModal, setShowModal] = useState(false);

  // Re-scan for wallets in case the extension injects window.midnight after
  // the initial render. We poll briefly and then stop.
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

  const handleConnect = async (selectedWallet: InitialAPI) => {
    setWallet(selectedWallet);
    setShowModal(false);
    await connect('preprod');
  };

  const handleClick = () => {
    if (isConnected) setShowAccountModal(true);
    else if (wallets.length === 1) handleConnect(wallets[0]);
    else if (wallets.length === 0) {
      window.open('https://www.lace.io/', '_blank');
    } else setShowModal(true);
  };

  let buttonContent;
  if (isConnecting) {
    buttonContent = (
      <>
        <Spinner className="w-4 h-4 animate-spin" />
        <span>Connecting...</span>
      </>
    );
  } else if (isConnected && addresses?.unshieldedAddress) {
    buttonContent = (
      <>
        <span className="font-mono text-sm tracking-wider">{formatAddress(addresses.unshieldedAddress)}</span>
        <ChevronDownIcon className="w-3.5 h-3.5 opacity-50" />
      </>
    );
  } else if (wallets.length === 0) {
    buttonContent = (
      <>
        <WalletIcon className="w-4 h-4" />
        <span>Install Wallet</span>
      </>
    );
  } else {
    buttonContent = (
      <>
        <WalletIcon className="w-4 h-4" />
        <span>Connect Wallet</span>
      </>
    );
  }

  return (
    <>
      <Button
        variant={isConnected ? 'secondary' : 'primary'}
        onClick={handleClick}
        disabled={isConnecting}
        className="inline-flex items-center gap-2"
        title={error || undefined}
      >
        {buttonContent}
      </Button>
      {error && !isConnecting && (
        <span className="ml-3 text-[11px] text-red-400/80 max-w-xs truncate" title={error}>
          {error}
        </span>
      )}
      <WalletSelectModal isOpen={showModal} onClose={() => setShowModal(false)} wallets={wallets} onSelect={handleConnect} connecting={isConnecting} />
    </>
  );
}
