import { useState } from 'react';
import { useWalletStore } from '../hooks/useWallet';
import { deriveRoleKey } from '../hooks/useIdentity';
import { hexToUint8Array } from '../lib/utils';
import { PRIVATE_STATE_ID } from '../hooks/wallet/wallet.constants';
import { buildProviders, loadCompiledContract } from '../lib/midnight';
import { createFundPrivateState } from './witnesses';
import { StatusPanel, StepHeader, type TxStatus } from '../components/ui/StatusPanel';

export function AdmitPage() {
  const { connectedApi, addresses } = useWalletStore();
  const [holderCommit, setHolderCommit] = useState('');
  const [allocation, setAllocation] = useState('5000000');
  const [status, setStatus] = useState<TxStatus>('idle');
  const [message, setMessage] = useState('');

  const validCommit = /^[0-9a-fA-F]{64}$/.test(holderCommit.trim());

  const admit = async () => {
    if (!connectedApi || !addresses) return;
    const contractAddress = localStorage.getItem('fund_contract');
    if (!contractAddress) {
      setStatus('error');
      setMessage('No deployed contract found.');
      return;
    }
    if (!validCommit) {
      setStatus('error');
      setMessage('Commitment must be 64 hex characters (32 bytes).');
      return;
    }
    setStatus('busy');
    setMessage('Deriving manager identity…');
    try {
      const managerSk = await deriveRoleKey(addresses.shieldedCoinPublicKey, 'manager');

      const providers = await buildProviders({
        connectedApi,
        shieldedCoinPublicKey: addresses.shieldedCoinPublicKey,
        shieldedEncryptionPublicKey: addresses.shieldedEncryptionPublicKey,
        privateStateStoreName: 'fund',
      });
      const { finalContract } = await loadCompiledContract();
      const { findDeployedContract, createCircuitCallTxInterface } = await import('@midnight-ntwrk/midnight-js-contracts');

      await findDeployedContract(providers as any, {
        contractAddress,
        compiledContract: finalContract as any,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: createFundPrivateState(managerSk),
      });

      const txInterface: any = createCircuitCallTxInterface(providers as any, finalContract as any, contractAddress, PRIVATE_STATE_ID);

      setMessage(`Admitting LP with allocation ${allocation}…`);
      await txInterface.admitLp(hexToUint8Array(holderCommit.trim()), BigInt(allocation));
      setStatus('success');
      setMessage('LP admitted. AUM updated.');
      setHolderCommit('');
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setMessage(e?.message || String(e));
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <StepHeader
        step={2}
        total={4}
        title="Admit limited partner"
        description="Only the GP can call this. The allocation is disclosed (it adds to the public AUM) — the LP's identity is not."
      />

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] uppercase tracking-widest text-white/30">LP commitment</label>
            <span className={`text-[10px] uppercase tracking-widest ${validCommit ? 'text-amber-200/80' : 'text-white/20'}`}>
              {validCommit ? '✓ 64 hex' : `${holderCommit.length}/64 hex`}
            </span>
          </div>
          <input
            type="text"
            value={holderCommit}
            onChange={(e) => setHolderCommit(e.target.value)}
            placeholder="abc123…"
            className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white font-mono text-[12px] focus:outline-none focus:border-white/20"
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-widest text-white/30 mb-2">Allocation</label>
          <input
            type="text"
            value={allocation}
            onChange={(e) => setAllocation(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-[13px] focus:outline-none focus:border-white/20"
          />
        </div>

        <button
          onClick={admit}
          disabled={status === 'busy' || !validCommit}
          className="w-full py-3 bg-amber-400 hover:bg-amber-300 disabled:opacity-30 text-black text-[13px] font-medium rounded-xl"
        >
          {status === 'busy' ? 'Submitting…' : 'Admit LP'}
        </button>

        <StatusPanel status={status} message={message} />
      </div>
    </div>
  );
}
