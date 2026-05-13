// Decorative preview shown on the non-connected landing page so screenshots
// look like a real working app.

export function LandingPreview() {
  return (
    <div className="w-full max-w-3xl mt-16 mb-4">
      <div className="relative">
        <div className="absolute inset-0 bg-amber-400/[0.04] blur-3xl rounded-3xl" />

        <div className="relative bg-gradient-to-b from-white/[0.04] to-white/[0.02] border border-white/[0.08] rounded-3xl p-6 shadow-2xl shadow-black/40">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <div className="ml-3 flex-1 h-6 bg-white/[0.04] rounded-md flex items-center px-3">
              <span className="text-[10px] font-mono text-white/30">localhost:5173</span>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1 bg-amber-500/[0.12] border border-amber-500/[0.25] rounded-md">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-300" />
              <span className="text-[10px] uppercase tracking-widest text-amber-200/80">Preprod</span>
            </div>
          </div>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-[18px] font-semibold text-white">Fund Dashboard</h3>
              <p className="text-[12px] text-white/30 mt-0.5">Global Macro I · Period 2026-05</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] border border-white/[0.1] rounded-lg">
              <span className="font-mono text-[11px] text-white/70">mn_shield_5d7a…02e1</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-6">
            <PreviewStat label="LPs" value="14" />
            <PreviewStat label="AUM" value="$67.2M" />
            <PreviewStat label="Payouts" value="13" />
            <PreviewStat label="ROI bp" value="+1200" highlight />
          </div>

          <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] uppercase tracking-widest text-white/40">LP commitment</p>
              <span className="text-[10px] uppercase tracking-widest text-amber-200/80 bg-amber-500/15 px-2 py-0.5 rounded">Ready</span>
            </div>
            <div className="text-[11px] font-mono text-white/40 break-all leading-relaxed">
              9a4e2c70f8b1d3e5af6c8d2b40e1f7a9c5b8e1d3f7a2b6c0d4e9a3b8c2f5d1e7
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <PreviewAction emoji="🏦" title="Deploy" />
            <PreviewAction emoji="🤝" title="Admit LP" />
            <PreviewAction emoji="📊" title="Report ROI" />
            <PreviewAction emoji="💰" title="Payout" />
          </div>
        </div>
      </div>
      <p className="text-center text-[11px] text-white/25 mt-5">
        Preview of the live dashboard. Open a Midnight wallet to see your own.
      </p>
    </div>
  );
}

function PreviewStat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`bg-white/[0.02] border border-white/[0.05] rounded-xl px-3 py-2.5 ${highlight ? 'border-amber-500/30' : ''}`}>
      <p className="text-[9px] uppercase tracking-widest text-white/30 mb-1">{label}</p>
      <p className={`text-[15px] font-semibold ${highlight ? 'text-amber-200' : 'text-white/80'}`}>{value}</p>
    </div>
  );
}

function PreviewAction({ emoji, title }: { emoji: string; title: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 text-center">
      <div className="text-[16px] mb-1.5">{emoji}</div>
      <p className="text-[11px] font-medium text-white/70">{title}</p>
    </div>
  );
}
