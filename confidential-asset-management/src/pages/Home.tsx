import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWalletStore } from '../hooks/useWallet';
import { useIdentity } from '../hooks/useIdentity';
import { uint8ArrayToHex, padTo32Bytes } from '../lib/utils';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { INDEXER_HTTP, INDEXER_WS } from '../hooks/wallet/wallet.constants';
import { LandingPreview } from '../components/LandingPreview';

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 4 5 5-7" />
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

const SAMPLE_BARS = [40, 55, 48, 62, 58, 75, 70, 82, 78, 88, 92, 100];

export function HomePage() {
  const { isConnected, addresses } = useWalletStore();
  const lpSk = useIdentity('lp');
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [fundId, setFundId] = useState('GLOBAL-MACRO-I');
  const [commitHex, setCommitHex] = useState('');
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<{ lps: bigint; payouts: bigint; aum: bigint; roi: bigint } | null>(null);

  useEffect(() => {
    setContractAddress(localStorage.getItem('fund_contract'));
  }, []);

  useEffect(() => {
    if (!lpSk) return;
    (async () => {
      const data = new Uint8Array(64);
      data.set(lpSk);
      data.set(padTo32Bytes(fundId), 32);
      const hash = await crypto.subtle.digest('SHA-256', data);
      setCommitHex(uint8ArrayToHex(new Uint8Array(hash)));
    })();
  }, [lpSk, fundId]);

  useEffect(() => {
    if (!contractAddress) return;
    (async () => {
      try {
        const provider = indexerPublicDataProvider(INDEXER_HTTP, INDEXER_WS);
        const state: any = await provider.queryContractState(contractAddress);
        if (!state) return;
        const contractPath = '/src/contracts/managed/fund' + '/contract/index.js';
        const contractModule: any = await import(/* @vite-ignore */ contractPath);
        const ledger = contractModule.ledger(state.data);
        setStats({
          lps: ledger.totalLps,
          payouts: ledger.totalPayouts,
          aum: ledger.aum,
          roi: ledger.reportedRoiBp,
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
          <ChartIcon className="w-9 h-9 text-amber-300/70" />
        </div>
        <h1 className="text-[clamp(2.5rem,6vw,4rem)] font-semibold tracking-tight leading-[1.05] mb-5">
          Allocate capital. Hide the book.
        </h1>
        <p className="text-[15px] text-white/40 max-w-md mb-10">
          On-chain fund management on Midnight. LPs stay anonymous, ROI is publicly verifiable, GP strategy stays private.
        </p>
        <p className="text-[13px] text-white/30">Open a Midnight wallet to start.</p>
        <LandingPreview />
      </div>
    );
  }

  const aum = stats?.aum.toString() ?? '0';
  const roiBp = stats?.roi ? Number(stats.roi) : 0;
  const roiPct = (roiBp / 100).toFixed(2);

  return (
    <div className="space-y-10 pt-4 pb-12">
      {/* FUND ADMIN HERO — big AUM number + ROI chart-like bars */}
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-500/[0.1] via-amber-500/[0.04] to-transparent border border-amber-500/[0.18] rounded-3xl p-8">
        <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-amber-400/[0.1] blur-3xl rounded-full" />
        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ChartIcon className="w-5 h-5 text-amber-300/80" />
              <p className="text-[11px] uppercase tracking-[0.15em] text-amber-200/70">Fund Admin</p>
            </div>
            <p className="text-[11px] uppercase tracking-widest text-white/40 mb-1">Assets Under Management</p>
            <p className="text-[56px] font-semibold tracking-tighter leading-none tabular-nums text-white">
              {Number(aum).toLocaleString()}
            </p>
            <div className="flex items-center gap-3 mt-4">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/[0.15] border border-amber-500/[0.3] rounded-lg">
                <span className="text-[11px] text-amber-200">+{roiPct}%</span>
                <span className="text-[10px] text-amber-300/60">period ROI</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-white/[0.04] border border-white/[0.08] rounded-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] uppercase tracking-widest text-white/60">Live · Preprod</span>
              </div>
            </div>
          </div>

          {/* Bar chart preview */}
          <div className="flex items-end gap-1.5 h-32">
            {SAMPLE_BARS.map((h, i) => (
              <div
                key={i}
                style={{ height: `${h}%` }}
                className={`flex-1 rounded-t ${i === SAMPLE_BARS.length - 1 ? 'bg-amber-300' : 'bg-amber-400/30'}`}
              />
            ))}
          </div>
        </div>

        <div className="relative mt-6 pt-6 border-t border-white/[0.06] grid grid-cols-3 gap-4">
          <BigStat label="LPs" value={stats?.lps.toString() ?? '—'} />
          <BigStat label="Payouts" value={stats?.payouts.toString() ?? '—'} />
          <BigStat label="ROI (bp)" value={stats?.roi.toString() ?? '—'} accent />
        </div>
      </div>

      {/* FUND LIST + COMMITMENT — side-by-side panel */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Active funds</p>
          <div className="space-y-2">
            {['GLOBAL-MACRO-I', 'EM-CREDIT-II', 'DELTA-NEUTRAL-A'].map((f) => (
              <button
                key={f}
                onClick={() => setFundId(f)}
                className={`w-full px-3 py-2.5 rounded-lg text-left transition-colors ${
                  fundId === f ? 'bg-amber-500/[0.12] border border-amber-500/[0.3]' : 'bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04]'
                }`}
              >
                <p className={`text-[12px] font-mono ${fundId === f ? 'text-amber-200' : 'text-white/60'}`}>{f}</p>
                <p className="text-[10px] text-white/30 mt-0.5">3yr · open · Preprod</p>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-[14px] font-medium text-white">LP commitment</h2>
              <p className="text-[11px] text-white/30 mt-1">For fund <span className="font-mono text-amber-200/80">{fundId}</span>. Hand to the GP off-chain.</p>
            </div>
            <div className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded ${lpSk ? 'bg-amber-500/[0.15] text-amber-200' : 'bg-white/[0.04] text-white/30'}`}>
              {lpSk ? 'Ready' : 'Deriving'}
            </div>
          </div>
          <div className="bg-black/40 border border-white/[0.05] rounded-xl px-4 py-3 mb-3">
            <p className="text-[12px] font-mono text-amber-200/80 break-all leading-relaxed">{commitHex || '...'}</p>
          </div>
          <button
            onClick={copy}
            disabled={!commitHex}
            className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-20 text-black text-[12px] font-medium rounded-xl flex items-center justify-center gap-2"
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
        <h2 className="text-[14px] font-medium text-white/70 mb-4">Fund actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Action to="/deploy" title="Deploy" desc="GP launches the fund" emoji="🏦" />
          <Action to="/admit" title="Admit LP" desc="GP admits a partner" emoji="🤝" />
          <Action to="/report" title="Report ROI" desc="GP publishes period ROI" emoji="📊" />
          <Action to="/payout" title="Payout" desc="LP claims period payout" emoji="💰" />
        </div>
      </div>
    </div>
  );
}

function BigStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.15em] text-white/30 mb-1.5">{label}</p>
      <p className={`text-[24px] font-semibold tracking-tight tabular-nums ${accent ? 'text-amber-200' : 'text-white'}`}>{value}</p>
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
    <Link to={to} className="group relative flex flex-col p-5 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] hover:border-amber-500/[0.2] rounded-2xl transition-all">
      <div className="text-[22px] mb-3">{emoji}</div>
      <h3 className="text-[14px] font-medium text-white/85 mb-1">{title}</h3>
      <p className="text-[12px] text-white/35 leading-relaxed">{desc}</p>
    </Link>
  );
}
