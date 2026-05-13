import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWalletStore } from '../hooks/useWallet';
import { useIdentity } from '../hooks/useIdentity';
import { uint8ArrayToHex, padTo32Bytes } from '../lib/utils';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { INDEXER_HTTP, INDEXER_WS } from '../hooks/wallet/wallet.constants';
import { LandingPreview } from '../components/LandingPreview';

function CoinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9 9h4a2 2 0 0 1 0 4H9a2 2 0 0 0 0 4h5" />
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

const SHARE_CLASSES = ['COMMON-A', 'COMMON-B', 'PREFERRED'];

const TICKER_ROWS = [
  { issuer: 'Acme Corp', class: 'COMMON-A', cycle: '2026-Q2', rate: '250', status: 'Declared' },
  { issuer: 'Zenith Holdings', class: 'PREFERRED', cycle: '2026-Q1', rate: '480', status: 'Paid' },
  { issuer: 'Northern Trust LP', class: 'COMMON-B', cycle: '2026-Q1', rate: '90', status: 'Paid' },
];

export function HomePage() {
  const { isConnected, addresses } = useWalletStore();
  const shareholderSk = useIdentity('shareholder');
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [classId, setClassId] = useState('COMMON-A');
  const [commitHex, setCommitHex] = useState('');
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<{ shareholders: bigint; paid: bigint; pool: bigint; declared: bigint } | null>(null);

  useEffect(() => {
    setContractAddress(localStorage.getItem('div_contract'));
  }, []);

  useEffect(() => {
    if (!shareholderSk) return;
    (async () => {
      const data = new Uint8Array(64);
      data.set(shareholderSk);
      data.set(padTo32Bytes(classId), 32);
      const hash = await crypto.subtle.digest('SHA-256', data);
      setCommitHex(uint8ArrayToHex(new Uint8Array(hash)));
    })();
  }, [shareholderSk, classId]);

  useEffect(() => {
    if (!contractAddress) return;
    (async () => {
      try {
        const provider = indexerPublicDataProvider(INDEXER_HTTP, INDEXER_WS);
        const state: any = await provider.queryContractState(contractAddress);
        if (!state) return;
        const contractPath = '/src/contracts/managed/dividend' + '/contract/index.js';
        const contractModule: any = await import(/* @vite-ignore */ contractPath);
        const ledger = contractModule.ledger(state.data);
        setStats({
          shareholders: ledger.totalShareholders,
          paid: ledger.totalDividendsPaid,
          pool: ledger.dividendPool,
          declared: ledger.declaredDividend,
        });
      } catch {
        // ignore
      }
    })();
  }, [contractAddress]);

  const copy = () => {
    navigator.clipboard.writeText(commitHex);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div className="w-[72px] h-[72px] rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-10">
          <CoinIcon className="w-9 h-9 text-violet-300/70" />
        </div>
        <h1 className="text-[clamp(2.5rem,6vw,4rem)] font-semibold tracking-tight leading-[1.05] mb-5">
          Pay dividends. Hide the cap table.
        </h1>
        <p className="text-[15px] text-white/40 max-w-md mb-10">
          Corporate dividend distribution on Midnight. ZK-verified eligibility, public payouts, anonymous shareholders.
        </p>
        <p className="text-[13px] text-white/30">Open a Midnight wallet to begin.</p>
        <LandingPreview />
      </div>
    );
  }

  return (
    <div className="space-y-10 pt-4 pb-12">
      {/* TERMINAL HEADER */}
      <div className="relative bg-gradient-to-br from-violet-500/[0.12] via-violet-500/[0.04] to-transparent border border-violet-500/[0.18] rounded-3xl overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/30 to-transparent" />
        <div className="p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CoinIcon className="w-5 h-5 text-violet-300/80" />
                <p className="text-[11px] uppercase tracking-[0.15em] text-violet-200/70">Shareholder Terminal</p>
              </div>
              <h1 className="text-[32px] font-semibold tracking-tight">Private dividend ledger</h1>
              <p className="text-[14px] text-white/50 mt-2 max-w-xl">
                Issuers declare dividends publicly. You prove eligibility and claim — without revealing your identity to the chain or other holders.
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/[0.15] border border-violet-500/[0.3] rounded-lg shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-300 animate-pulse" />
              <span className="text-[11px] uppercase tracking-widest text-violet-200">Live · Preprod</span>
            </div>
          </div>

          {/* Big numbers strip — finance terminal vibe */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/[0.06]">
            <BigStat label="Shareholders" value={stats?.shareholders.toString() ?? '—'} />
            <BigStat label="Cycles paid" value={stats?.paid.toString() ?? '—'} />
            <BigStat label="Pool" value={stats?.pool.toString() ?? '—'} />
            <BigStat label="Rate/share" value={stats?.declared.toString() ?? '—'} accent />
          </div>
        </div>
      </div>

      {/* TICKER */}
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between bg-white/[0.02]">
          <h2 className="text-[13px] font-medium text-white/80">Recent declarations</h2>
          <span className="text-[10px] uppercase tracking-widest text-white/30">Indexed · live</span>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {TICKER_ROWS.map((row, i) => (
            <div key={i} className="px-5 py-3 grid grid-cols-12 items-center gap-3 hover:bg-white/[0.02] transition-colors">
              <div className="col-span-4">
                <p className="text-[13px] font-medium text-white">{row.issuer}</p>
                <p className="text-[11px] text-white/30 font-mono mt-0.5">{row.class}</p>
              </div>
              <div className="col-span-3">
                <p className="text-[10px] uppercase tracking-widest text-white/30">Cycle</p>
                <p className="text-[12px] font-mono text-white/80">{row.cycle}</p>
              </div>
              <div className="col-span-3 text-right">
                <p className="text-[10px] uppercase tracking-widest text-white/30">Rate</p>
                <p className="text-[14px] font-semibold text-violet-200">{row.rate}</p>
              </div>
              <div className="col-span-2 text-right">
                <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded ${row.status === 'Paid' ? 'bg-white/[0.06] text-white/50' : 'bg-violet-500/[0.15] text-violet-200'}`}>
                  {row.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* COMMITMENT BUILDER — two-column corporate style */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
        <div className="md:col-span-2 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Pick share class</p>
          <div className="space-y-1.5">
            {SHARE_CLASSES.map((c) => (
              <button
                key={c}
                onClick={() => setClassId(c)}
                className={`w-full px-3 py-2 rounded-lg text-[12px] font-mono text-left transition-colors ${
                  classId === c ? 'bg-violet-500/[0.15] text-violet-200 border border-violet-500/[0.3]' : 'bg-white/[0.02] text-white/60 border border-white/[0.05] hover:bg-white/[0.04]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-[14px] font-medium text-white">Your commitment</h2>
              <p className="text-[11px] text-white/30 mt-1">Send to the issuer for cap-table registration.</p>
            </div>
            <div className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded ${shareholderSk ? 'bg-violet-500/[0.15] text-violet-200' : 'bg-white/[0.04] text-white/30'}`}>
              {shareholderSk ? 'Ready' : 'Deriving'}
            </div>
          </div>
          <div className="bg-black/40 border border-white/[0.05] rounded-xl px-4 py-3 mb-3">
            <p className="text-[12px] font-mono text-violet-200/80 break-all leading-relaxed">{commitHex || '...'}</p>
          </div>
          <button
            onClick={copy}
            disabled={!commitHex}
            className="w-full py-2.5 bg-violet-400 hover:bg-violet-300 disabled:opacity-20 text-black text-[12px] font-medium rounded-xl flex items-center justify-center gap-2"
          >
            <CopyIcon className="w-3.5 h-3.5" />
            {copied ? 'Copied to clipboard' : 'Copy commitment'}
          </button>
        </div>
      </div>

      {/* CONTRACT INFO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <InlineStat label="Contract" value={contractAddress ? contractAddress.slice(0, 14) + '…' : 'Not deployed'} muted={!contractAddress} />
        <InlineStat label="Wallet" value={addresses?.unshieldedAddress.slice(0, 14) + '…' || '—'} />
      </div>

      {/* ACTIONS */}
      <div>
        <h2 className="text-[14px] font-medium text-white/70 mb-4">Next steps</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Action to="/deploy" title="Deploy" desc="Issuer launches contract" emoji="🏛️" />
          <Action to="/register" title="Register" desc="Issuer admits shareholder" emoji="📋" />
          <Action to="/declare" title="Declare" desc="Top up + set rate" emoji="💎" />
          <Action to="/claim" title="Claim" desc="Holder claims dividend" emoji="💰" />
        </div>
      </div>
    </div>
  );
}

function BigStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.15em] text-white/30 mb-1.5">{label}</p>
      <p className={`text-[28px] font-semibold tracking-tight tabular-nums ${accent ? 'text-violet-200' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function InlineStat({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3">
      <span className="text-[11px] uppercase tracking-widest text-white/30">{label}</span>
      <span className={`text-[12px] font-mono ${muted ? 'text-white/30' : 'text-white/80'}`}>{value}</span>
    </div>
  );
}

function Action({ to, title, desc, emoji }: { to: string; title: string; desc: string; emoji: string }) {
  return (
    <Link to={to} className="group relative flex flex-col p-5 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] hover:border-violet-500/[0.2] rounded-2xl transition-all">
      <div className="text-[22px] mb-3">{emoji}</div>
      <h3 className="text-[14px] font-medium text-white/85 mb-1">{title}</h3>
      <p className="text-[12px] text-white/35 leading-relaxed">{desc}</p>
    </Link>
  );
}
