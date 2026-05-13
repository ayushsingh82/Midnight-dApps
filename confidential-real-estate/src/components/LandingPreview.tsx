// Static, decorative preview shown on the non-connected landing page so
// screenshots and demos look like a real working app even before any
// wallet is connected.

export function LandingPreview() {
  return (
    <div className="w-full max-w-3xl mt-16 mb-4">
      <div className="relative">
        {/* Soft glow behind the card */}
        <div className="absolute inset-0 bg-emerald-400/[0.04] blur-3xl rounded-3xl" />

        <div className="relative bg-gradient-to-b from-white/[0.04] to-white/[0.02] border border-white/[0.08] rounded-3xl p-6 shadow-2xl shadow-black/40">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 mb-5">
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <div className="ml-3 flex-1 h-6 bg-white/[0.04] rounded-md flex items-center px-3">
              <span className="text-[10px] font-mono text-white/30">localhost:5173</span>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-500/[0.1] border border-emerald-500/[0.2] rounded-md">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] uppercase tracking-widest text-emerald-300/80">Preprod</span>
            </div>
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-[18px] font-semibold text-white">Investor Dashboard</h3>
              <p className="text-[12px] text-white/30 mt-0.5">Privacy-preserving real estate</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] border border-white/[0.1] rounded-lg">
              <span className="font-mono text-[11px] text-white/70">mn_shield_8a3f…b27c</span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <PreviewStat label="Properties" value="12" />
            <PreviewStat label="Shares" value="318" />
            <PreviewStat label="Rental pool" value="₤4.2M" />
          </div>

          {/* Commitment card preview */}
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] uppercase tracking-widest text-white/40">Ownership commitment</p>
              <span className="text-[10px] uppercase tracking-widest text-emerald-300/70 bg-emerald-500/10 px-2 py-0.5 rounded">Ready</span>
            </div>
            <div className="text-[11px] font-mono text-white/40 break-all leading-relaxed">
              c4e29a16f1bd0e85ac7d2b51a8f3c9d4e0b6a8f7c1e9d3a5b8e2f4a6c0d2b4e6
            </div>
          </div>

          {/* Action grid */}
          <div className="grid grid-cols-3 gap-3">
            <PreviewAction emoji="🏗️" title="Deploy" desc="Sponsor property" />
            <PreviewAction emoji="📜" title="Issue Shares" desc="Attest investor" />
            <PreviewAction emoji="💰" title="Claim Yield" desc="Prove + claim" />
          </div>
        </div>
      </div>
      <p className="text-center text-[11px] text-white/25 mt-5">
        Preview of the live dashboard. Open a Midnight wallet to see your own.
      </p>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl px-3 py-2.5">
      <p className="text-[9px] uppercase tracking-widest text-white/30 mb-1">{label}</p>
      <p className="text-[15px] font-semibold text-white/80">{value}</p>
    </div>
  );
}

function PreviewAction({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3">
      <div className="text-[16px] mb-1.5">{emoji}</div>
      <p className="text-[11px] font-medium text-white/70">{title}</p>
      <p className="text-[10px] text-white/30 mt-0.5">{desc}</p>
    </div>
  );
}
