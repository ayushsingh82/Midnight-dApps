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

const SAMPLE_PROPERTIES = [
  { id: 'LDN-COVENT-001', name: 'Covent Garden Lofts', city: 'London', yield: '8.4%', shares: '128' },
  { id: 'NYC-TRIBECA-014', name: 'Tribeca Brownstones', city: 'New York', yield: '6.1%', shares: '72' },
  { id: 'SGP-ORCHARD-007', name: 'Orchard Tower 19F', city: 'Singapore', yield: '5.8%', shares: '54' },
];

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

  return (
    <div className="space-y-10 pt-4 pb-12">
      {/* HERO BANNER */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500/[0.12] via-emerald-500/[0.05] to-transparent border border-emerald-500/[0.18] rounded-3xl p-8">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-400/[0.15] blur-3xl rounded-full" />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BuildingIcon className="w-5 h-5 text-emerald-300/80" />
              <p className="text-[11px] uppercase tracking-[0.15em] text-emerald-200/70">Investor Portal</p>
            </div>
            <h1 className="text-[32px] font-semibold tracking-tight">Your private real-estate book</h1>
            <p className="text-[14px] text-white/50 mt-2 max-w-xl">
              Hand a commitment to a property sponsor and collect rental yield each cycle — never linking your wallet to a property on-chain.
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/[0.12] border border-emerald-500/[0.3] rounded-lg shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[11px] uppercase tracking-widest text-emerald-200">Live · Preprod</span>
          </div>
        </div>
      </div>

      {/* PROPERTY GALLERY */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-medium text-white/80">Featured properties</h2>
          <span className="text-[11px] text-white/30">Click to set the commitment scope</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SAMPLE_PROPERTIES.map((p) => {
            const active = p.id === propertyId;
            return (
              <button
                key={p.id}
                onClick={() => setPropertyId(p.id)}
                className={`text-left p-5 rounded-2xl border transition-all ${
                  active
                    ? 'bg-emerald-500/[0.08] border-emerald-500/[0.35]'
                    : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                }`}
              >
                <div className={`w-full h-24 rounded-xl mb-4 bg-gradient-to-br ${active ? 'from-emerald-400/30 to-emerald-600/10' : 'from-white/[0.06] to-white/[0.02]'}`} />
                <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">{p.city}</p>
                <p className="text-[14px] font-medium text-white">{p.name}</p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.05]">
                  <div>
                    <p className="text-[9px] uppercase text-white/30">Yield</p>
                    <p className={`text-[13px] font-semibold ${active ? 'text-emerald-300' : 'text-white/80'}`}>{p.yield}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase text-white/30">Shares</p>
                    <p className="text-[13px] font-semibold text-white/80">{p.shares}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* COMMITMENT CARD */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-[16px] font-medium text-white">Ownership commitment</h2>
            <p className="text-[12px] text-white/30 mt-1">
              Send this hex string to the sponsor of <span className="text-emerald-300/80 font-mono">{propertyId}</span>. They insert it into the Merkle tree — your wallet stays hidden.
            </p>
          </div>
          <div className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded ${investorSk ? 'bg-emerald-500/[0.12] text-emerald-300/90' : 'bg-white/[0.04] text-white/30'}`}>
            {investorSk ? 'Ready' : 'Deriving'}
          </div>
        </div>

        <div className="flex items-stretch gap-2">
          <div className="flex-1 px-4 py-3 bg-black/40 border border-white/[0.05] rounded-xl min-h-[48px] flex items-center">
            <p className="text-[12px] font-mono text-emerald-200/70 break-all leading-relaxed">{commitHex || '...'}</p>
          </div>
          <button
            onClick={copy}
            disabled={!commitHex}
            className="px-5 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-20 text-black text-[12px] font-medium rounded-xl flex items-center gap-2"
          >
            <CopyIcon className="w-3.5 h-3.5" />
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* INFO GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat label="Active contract" value={contractAddress ? contractAddress.slice(0, 12) + '…' : 'Not deployed'} muted={!contractAddress} />
        <Stat label="Wallet" value={addresses?.unshieldedAddress.slice(0, 12) + '…' || '—'} />
        <Stat label="Selected property" value={propertyId} />
      </div>

      {/* ACTIONS */}
      <div>
        <h2 className="text-[14px] font-medium text-white/70 mb-4">Next steps</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Action to="/deploy" title="Deploy" desc="Sponsor a property contract" emoji="🏗️" />
          <Action to="/issue" title="Issue shares" desc="Sponsor attests an investor" emoji="📜" />
          <Action to="/claim" title="Claim yield" desc="Privately prove + collect" emoji="💰" />
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
      className="group relative flex flex-col p-5 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] hover:border-emerald-500/[0.18] rounded-2xl transition-all"
    >
      <div className="text-[22px] mb-3">{emoji}</div>
      <h3 className="text-[14px] font-medium text-white/85 mb-1">{title}</h3>
      <p className="text-[12px] text-white/35 leading-relaxed">{desc}</p>
    </Link>
  );
}
