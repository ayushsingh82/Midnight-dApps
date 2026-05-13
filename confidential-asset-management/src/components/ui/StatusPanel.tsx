import { cn } from '../../lib/utils';

export type TxStatus = 'idle' | 'busy' | 'success' | 'error';

interface StatusPanelProps {
  status: TxStatus;
  message?: string | null;
  className?: string;
}

function Dot({ status }: { status: TxStatus }) {
  if (status === 'busy') return <div className="w-3 h-3 border border-white/30 border-t-white/80 rounded-full animate-spin" />;
  if (status === 'success') return <div className="w-2 h-2 rounded-full bg-emerald-400" />;
  if (status === 'error') return <div className="w-2 h-2 rounded-full bg-red-400" />;
  return <div className="w-2 h-2 rounded-full bg-white/20" />;
}

export function StatusPanel({ status, message, className }: StatusPanelProps) {
  if (!message && status === 'idle') return null;

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 rounded-xl border',
        status === 'busy' && 'bg-white/[0.02] border-white/[0.08]',
        status === 'success' && 'bg-emerald-500/[0.06] border-emerald-500/[0.18]',
        status === 'error' && 'bg-red-500/[0.06] border-red-500/[0.18]',
        status === 'idle' && 'bg-white/[0.02] border-white/[0.06]',
        className
      )}
    >
      <div className="mt-1.5">
        <Dot status={status} />
      </div>
      <p
        className={cn(
          'text-[12px] leading-relaxed font-mono break-words flex-1',
          status === 'busy' && 'text-white/60',
          status === 'success' && 'text-emerald-200/90',
          status === 'error' && 'text-red-200/90',
          status === 'idle' && 'text-white/50'
        )}
      >
        {message}
      </p>
    </div>
  );
}

interface StepHeaderProps {
  step: number;
  total: number;
  title: string;
  description?: string;
}

export function StepHeader({ step, total, title, description }: StepHeaderProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">
          Step {step} of {total}
        </span>
        <div className="flex-1 h-px bg-white/[0.06]" />
      </div>
      <h1 className="text-[24px] font-semibold tracking-tight text-white">{title}</h1>
      {description && <p className="text-[13px] text-white/40 mt-1.5 leading-relaxed">{description}</p>}
    </div>
  );
}
