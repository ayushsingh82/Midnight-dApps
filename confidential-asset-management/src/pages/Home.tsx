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

  const ready = !!lpSk;

  return (
    <div className="space-y-10 pt-4 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Fund Dashboard</h1>
          <p className="text-[14px] text-white/30 mt-1.5">Privacy-preserving capital allocation and payouts.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/[0.1] border border-amber-500/[0.25] rounded-lg">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-300" />
          <span className="text-[11px] uppercase tracking-widest text-amber-200/80">Connected</span>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="LPs" value={stats.lps.toString()} />
          <Stat label="AUM" value={stats.aum.toString()} />
          <Stat label="Payouts" value={stats.payouts.toString()} />
          <Stat label="ROI (bp)" value={stats.roi.toString()} />
        </div>
      )}

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[16px] font-medium text-white">LP commitment</h2>
            <p className="text-[12px] text-white/30 mt-1 max-w-md">
              Hash of your wallet + fund ID. Hand it to the fund manager off-chain — the manager admits you into the LP Merkle tree without seeing your wallet.
            </p>
          </div>
          <div className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded ${ready ? 'bg-amber-500/15 text-amber-200/80' : 'bg-white/[0.04] text-white/30'}`}>
            {ready ? 'Ready' : 'Deriving…'}
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-widest text-white/30 mb-2">Fund ID</label>
          <input
            type="text"
            value={fundId}
            onChange={(e) => setFundId(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-[13px] focus:outline-none focus:border-white/20"
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
              className="px-4 bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-20 border border-white/[0.08] text-white/70 text-[12px] font-medium rounded-xl flex items-center gap-2"
            >
              <CopyIcon className="w-3.5 h-3.5" />
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-[14px] font-medium text-white/70 mb-4">Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Action to="/deploy" title="Deploy" desc="GP launches the fund" emoji="🏦" />
          <Action to="/admit" title="Admit LP" desc="GP admits an LP" emoji="🤝" />
          <Action to="/report" title="Report ROI" desc="GP publishes period ROI" emoji="📊" />
          <Action to="/payout" title="Payout" desc="LP claims period payout" emoji="💰" />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4">
      <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1.5">{label}</p>
      <p className="text-[20px] font-semibold text-white truncate">{value}</p>
    </div>
  );
}

function Action({ to, title, desc, emoji }: { to: string; title: string; desc: string; emoji: string }) {
  return (
    <Link to={to} className="group relative flex flex-col p-5 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] hover:border-white/[0.1] rounded-2xl transition-all">
      <div className="text-[22px] mb-3">{emoji}</div>
      <h3 className="text-[14px] font-medium text-white/85 mb-1">{title}</h3>
      <p className="text-[12px] text-white/35 leading-relaxed">{desc}</p>
    </Link>
  );
}
