import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWalletStore } from '../hooks/useWallet';
import { useIdentity } from '../hooks/useIdentity';
import { uint8ArrayToHex, padTo32Bytes } from '../lib/utils';
import { LandingPreview } from '../components/LandingPreview';

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 7h1M9 11h1M9 15h1M14 7h1M14 11h1M14 15h1" />
      <path d="M10 21v-3h4v3" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function HomePage() {
  const { isConnected, addresses } = useWalletStore();
  const investorSk = useIdentity('investor');
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState('LDN-COVENT-001');
  const [commitHex, setCommitHex] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setContractAddress(localStorage.getItem('re_contract'));
  }, []);

  useEffect(() => {
    if (!investorSk) return;
    (async () => {
      const data = new Uint8Array(64);
      data.set(investorSk);
      data.set(padTo32Bytes(propertyId), 32);
      const hash = await crypto.subtle.digest('SHA-256', data);
      setCommitHex(uint8ArrayToHex(new Uint8Array(hash)));
    })();
  }, [investorSk, propertyId]);

  const copy = () => {
    navigator.clipboard.writeText(commitHex);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

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
        <p className="text-[13px] text-white/30">Open a Midnight wallet to begin.</p>
        <LandingPreview />
      </div>
    );
  }

  const ready = !!investorSk;

  return (
    <div className="space-y-10 pt-4 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Investor Dashboard</h1>
          <p className="text-[14px] text-white/30 mt-1.5">Generate ownership commitments and claim rental yield.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/[0.08] border border-emerald-500/[0.2] rounded-lg">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[11px] uppercase tracking-widest text-emerald-300/80">Connected</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat label="Contract" value={contractAddress ? contractAddress.slice(0, 10) + '…' : 'Not deployed'} muted={!contractAddress} />
        <Stat label="Wallet" value={addresses?.unshieldedAddress.slice(0, 10) + '…' || '—'} />
        <Stat label="Network" value="Preprod" />
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[16px] font-medium text-white">Ownership commitment</h2>
            <p className="text-[12px] text-white/30 mt-1 max-w-md">
              Hash of your wallet identity + the property ID. Share with the sponsor to receive shares — your wallet stays hidden.
            </p>
          </div>
          <div className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded ${ready ? 'bg-emerald-500/10 text-emerald-300/80' : 'bg-white/[0.04] text-white/30'}`}>
            {ready ? 'Ready' : 'Deriving…'}
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-widest text-white/30 mb-2">Property ID</label>
          <input
            type="text"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-[13px] focus:outline-none focus:border-white/20 transition-colors"
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-widest text-white/30 mb-2">Commitment (hex)</label>
          <div className="flex items-stretch gap-2">
            <div className="flex-1 px-3.5 py-2.5 bg-white/[0.02] border border-white/[0.05] rounded-xl min-h-[42px] flex items-center">
              <p className="text-[11px] font-mono text-white/40 break-all leading-relaxed">{commitHex || '...'}</p>
            </div>
            <button
              onClick={copy}
              disabled={!commitHex}
              className="px-4 bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-20 border border-white/[0.08] text-white/70 text-[12px] font-medium rounded-xl transition-colors flex items-center gap-2"
            >
              <CopyIcon className="w-3.5 h-3.5" />
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-[14px] font-medium text-white/70 mb-4">Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Action to="/deploy" title="Deploy" desc="Sponsor a new property contract" emoji="🏗️" />
          <Action to="/issue" title="Issue Shares" desc="Sponsor attests investor commitments" emoji="📜" />
          <Action to="/claim" title="Claim Yield" desc="Privately prove ownership and claim rent" emoji="💰" />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4">
      <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1.5">{label}</p>
      <p className={`text-[14px] font-mono truncate ${muted ? 'text-white/30' : 'text-white/90'}`}>{value}</p>
    </div>
  );
}

function Action({ to, title, desc, emoji }: { to: string; title: string; desc: string; emoji: string }) {
  return (
    <Link
      to={to}
      className="group relative flex flex-col p-5 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] hover:border-white/[0.1] rounded-2xl transition-all"
    >
      <div className="text-[22px] mb-3">{emoji}</div>
      <h3 className="text-[14px] font-medium text-white/85 mb-1">{title}</h3>
      <p className="text-[12px] text-white/35 leading-relaxed">{desc}</p>
      <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity">
        <svg className="w-4 h-4 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
