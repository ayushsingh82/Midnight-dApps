import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWalletStore } from '../hooks/useWallet';
import { deriveKey, deriveKeyFromPassword, generateRandomPassword, validatePassword, uint8ArrayToHex, padTo32Bytes } from '../lib/utils';

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 7h1M9 11h1M9 15h1M14 7h1M14 11h1M14 15h1" />
      <path d="M10 21v-3h4v3" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export function HomePage() {
  const { isConnected, addresses, userPassword, setUserPassword } = useWalletStore();
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [secretKey, setSecretKey] = useState<Uint8Array | null>(null);
  const [pwd, setPwd] = useState('');
  const [genPwd, setGenPwd] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState('LDN-COVENT-001');
  const [commitHex, setCommitHex] = useState<string>('');

  useEffect(() => {
    setContractAddress(localStorage.getItem('re_contract'));
  }, []);

  const deriveIdentity = async (password: string): Promise<boolean> => {
    setKeyError(null);
    const validation = validatePassword(password);
    if (validation) {
      setKeyError(validation);
      return false;
    }
    if (!addresses?.shieldedCoinPublicKey) {
      setKeyError('Wallet not connected.');
      return false;
    }
    const master = await deriveKeyFromPassword(password, addresses.shieldedCoinPublicKey);
    const sk = await deriveKey(master, 'realestate:investor');
    setSecretKey(sk);
    return true;
  };

  const unlock = async () => {
    const ok = await deriveIdentity(pwd);
    if (ok) {
      setUserPassword(pwd);
      setPwd('');
      setGenPwd(null);
    }
  };

  const generate = async () => {
    const p = generateRandomPassword();
    setGenPwd(p);
    const ok = await deriveIdentity(p);
    if (ok) setUserPassword(p);
  };

  useEffect(() => {
    if (!secretKey) return;
    (async () => {
      const data = new Uint8Array(64);
      data.set(secretKey);
      data.set(padTo32Bytes(propertyId), 32);
      const hash = await crypto.subtle.digest('SHA-256', data);
      setCommitHex(uint8ArrayToHex(new Uint8Array(hash)));
    })();
  }, [secretKey, propertyId]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div className="w-[72px] h-[72px] rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-10">
          <BuildingIcon className="w-9 h-9 text-emerald-300/70" />
        </div>
        <h1 className="text-[clamp(2.5rem,6vw,4rem)] font-semibold tracking-tight leading-[1.05] mb-5">
          Own property. Stay private.
        </h1>
        <p className="text-[15px] text-white/40 max-w-md mb-10">
          Tokenized property shares with private ownership and rental-yield claims on the Midnight network. Regulators see proofs; counterparties see nothing.
        </p>
        <Link to="/deploy" className="px-7 py-3 bg-white hover:bg-white/90 text-black text-[14px] font-medium rounded-xl">
          Get Started
        </Link>
      </div>
    );
  }

  if (!userPassword) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-6">
          <ShieldIcon className="w-7 h-7 text-white/40" />
        </div>
        <h2 className="text-[22px] font-semibold tracking-tight mb-2">Unlock Investor Vault</h2>
        <p className="text-[14px] text-white/25 mb-8 max-w-sm">
          Your password + wallet shielded key deterministically derive your investor secret. Lose either and the identity is lost forever.
        </p>
        <div className="w-full max-w-sm space-y-3">
          <input
            type="password"
            value={pwd}
            onChange={(e) => { setPwd(e.target.value); setKeyError(null); }}
            onKeyDown={(e) => e.key === 'Enter' && unlock()}
            placeholder="Enter password (min 16 chars)"
            className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-[13px] focus:outline-none focus:border-white/20"
          />
          {keyError && <p className="text-[12px] text-red-400/70">{keyError}</p>}
          <button onClick={unlock} disabled={!pwd.trim()} className="w-full py-3 bg-white hover:bg-white/90 disabled:opacity-30 text-black text-[13px] font-medium rounded-xl">
            Unlock
          </button>
          <button onClick={generate} className="w-full py-3 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] text-white/60 text-[13px] font-medium rounded-xl">
            Generate Random Password
          </button>
          {genPwd && <p className="text-[11px] font-mono text-amber-300/70 break-all">{genPwd}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pt-4 pb-12">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight">Investor Dashboard</h1>
        <p className="text-[14px] text-white/30 mt-1">Privacy-preserving real estate holdings</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat label="Contract" value={contractAddress ? contractAddress.slice(0, 10) + '…' : '—'} />
        <Stat label="Property" value={propertyId} />
        <Stat label="Network" value="Preprod" />
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
        <p className="text-[10px] uppercase tracking-[0.1em] text-white/30">Ownership Commitment</p>
        <input
          type="text"
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-[13px] focus:outline-none focus:border-white/20"
        />
        <p className="text-[11px] font-mono text-white/40 break-all leading-relaxed">{commitHex || '...'}</p>
        <p className="text-[11px] text-white/30">
          Share this commitment with the property sponsor. The sponsor inserts it into the Merkle tree, granting you ownership without revealing your wallet.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Action to="/deploy" title="Deploy" desc="Sponsor a new property contract" />
        <Action to="/issue" title="Issue Shares" desc="Sponsor attests investor commitments" />
        <Action to="/claim" title="Claim Yield" desc="Privately prove ownership and claim rent" />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-tertiary/40 border border-border/80 rounded-2xl p-4">
      <p className="text-[11px] uppercase tracking-widest text-text-muted mb-1">{label}</p>
      <p className="text-[15px] font-mono text-white truncate">{value}</p>
    </div>
  );
}

function Action({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link to={to} className="flex flex-col p-6 bg-white/[0.02] border border-white/[0.05] rounded-2xl hover:bg-white/[0.04] hover:border-white/[0.08] transition-all">
      <h3 className="text-[14px] font-medium text-white/80 mb-1.5">{title}</h3>
      <p className="text-[13px] text-white/25">{desc}</p>
    </Link>
  );
}
