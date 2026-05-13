import { useState } from 'react';
import { useWalletStore } from '../hooks/useWallet';
import { deriveRoleKey } from '../hooks/useIdentity';
import { padTo32Bytes } from '../lib/utils';
import { PRIVATE_STATE_ID } from '../hooks/wallet/wallet.constants';
import { buildProviders, loadCompiledContract } from '../lib/midnight';
import { createDividendPrivateState } from './witnesses';
import { StatusPanel, StepHeader, type TxStatus } from '../components/ui/StatusPanel';

export function ClaimPage() {
  const { connectedApi, addresses } = useWalletStore();
  const [classId, setClassId] = useState('COMMON-A');
  const [cycle, setCycle] = useState('2026-Q2');
  const [status, setStatus] = useState<TxStatus>('idle');
  const [message, setMessage] = useState('');

  const run = async (mode: 'prove' | 'claim') => {
    if (!connectedApi || !addresses) return;
    const contractAddress = localStorage.getItem('div_contract');
    if (!contractAddress) {
      setStatus('error');
      setMessage('No deployed contract found.');
      return;
    }
    setStatus('busy');
    setMessage('Deriving shareholder identity…');
    try {
      const shareholderSk = await deriveRoleKey(addresses.shieldedCoinPublicKey, 'shareholder');

      const providers = await buildProviders({
        connectedApi,
        shieldedCoinPublicKey: addresses.shieldedCoinPublicKey,
        shieldedEncryptionPublicKey: addresses.shieldedEncryptionPublicKey,
        privateStateStoreName: 'dividend-shareholder',
      });
      const { finalContract } = await loadCompiledContract();
      const { findDeployedContract, createCircuitCallTxInterface } = await import('@midnight-ntwrk/midnight-js-contracts');

      await findDeployedContract(providers as any, {
        contractAddress,
        compiledContract: finalContract as any,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: createDividendPrivateState(shareholderSk),
      });

      const txInterface: any = createCircuitCallTxInterface(providers as any, finalContract as any, contractAddress, PRIVATE_STATE_ID);

      if (mode === 'prove') {
        setMessage('Generating eligibility proof…');
        await txInterface.proveEligibility(padTo32Bytes(classId));
        setStatus('success');
        setMessage('Eligibility proven without revealing identity.');
      } else {
        setMessage('Claiming dividend…');
        await txInterface.claimDividend(padTo32Bytes(classId), padTo32Bytes(cycle));
        setStatus('success');
        setMessage(`Dividend claimed for cycle ${cycle}. Nullifier locked.`);
      }
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setMessage(e?.message || String(e));
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <StepHeader
        step={4}
        total={4}
        title="Claim dividend"
        description="Prove you're a shareholder, or claim the current cycle's declared dividend. The nullifier prevents double-claims."
      />

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Share class" value={classId} onChange={setClassId} />
          <Field label="Cycle" value={cycle} onChange={setCycle} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => run('prove')}
            disabled={status === 'busy'}
            className="py-3 bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-white text-[13px] font-medium rounded-xl disabled:opacity-30"
          >
            {status === 'busy' ? '…' : 'Prove eligibility'}
          </button>
          <button
            onClick={() => run('claim')}
            disabled={status === 'busy'}
            className="py-3 bg-violet-400 hover:bg-violet-300 disabled:opacity-30 text-black text-[13px] font-medium rounded-xl"
          >
            {status === 'busy' ? '…' : 'Claim dividend'}
          </button>
        </div>

        <StatusPanel status={status} message={message} />
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-widest text-white/30 mb-1.5">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-[13px] focus:outline-none focus:border-white/20"
      />
    </div>
  );
}
