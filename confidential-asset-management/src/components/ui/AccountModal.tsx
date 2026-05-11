import { useWalletStore } from '../../hooks/useWallet';
import { Modal } from './Modal';

function short(s: string): string {
  return s.length > 16 ? `${s.slice(0, 8)}...${s.slice(-6)}` : s;
}

export function AccountModal() {
  const { showAccountModal, setShowAccountModal, addresses, disconnect } = useWalletStore();

  return (
    <Modal isOpen={showAccountModal} onClose={() => setShowAccountModal(false)}>
      <div className="w-[420px] bg-bg-secondary border border-border rounded-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-5">
          <h3 className="text-[17px] font-semibold tracking-tight text-white mb-5">Account</h3>
          {addresses && (
            <div className="space-y-3">
              <Row label="Unshielded" value={short(addresses.unshieldedAddress)} />
              <Row label="Shielded" value={short(addresses.shieldedAddress)} />
              <Row label="Dust" value={short(addresses.dustAddress)} />
            </div>
          )}
          <div className="mt-6 pt-4 border-t border-border/50 flex justify-end gap-2">
            <button
              onClick={() => {
                disconnect();
                setShowAccountModal(false);
              }}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[13px] font-medium rounded-lg transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between bg-bg-tertiary/40 border border-border/60 rounded-xl px-4 py-2.5">
      <span className="text-[12px] text-text-muted uppercase tracking-wider">{label}</span>
      <span className="font-mono text-[12px] text-white/80">{value}</span>
    </div>
  );
}
