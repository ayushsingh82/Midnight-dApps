import { useState } from 'react';
import { useWalletStore } from '../hooks/useWallet';
import { deriveRoleKey } from '../hooks/useIdentity';
import { PRIVATE_STATE_ID } from '../hooks/wallet/wallet.constants';
import { buildProviders, loadCompiledContract } from '../lib/midnight';
import { createFundPrivateState } from './witnesses';
import { StatusPanel, StepHeader, type TxStatus } from '../components/ui/StatusPanel';

export function ReportPage() {
  const { connectedApi, addresses } = useWalletStore();
  const [roi, setRoi] = useState('1200');
  const [status, setStatus] = useState<TxStatus>('idle');
  const [message, setMessage] = useState('');

  const report = async () => {
    if (!connectedApi || !addresses) return;
    const contractAddress = localStorage.getItem('fund_contract');
    if (!contractAddress) {
      setStatus('error');
      setMessage('No deployed contract found.');
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

      setMessage(`Reporting ROI of ${roi} bp…`);
      await txInterface.reportRoi(BigInt(roi));
      setStatus('success');
      setMessage(`ROI of ${roi} bp reported. Public + verifiable.`);
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setMessage(e?.message || String(e));
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <StepHeader
        step={3}
        total={4}
        title="Report ROI"
        description="Publish the period's ROI in basis points (1200 = +12.00%). Public on-chain; the underlying strategy stays off-chain."
      />

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-5">
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-white/30 mb-2">ROI (basis points)</label>
          <input
            type="text"
            value={roi}
            onChange={(e) => setRoi(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-[13px] focus:outline-none focus:border-white/20"
          />
        </div>

        <button
          onClick={report}
          disabled={status === 'busy'}
          className="w-full py-3 bg-amber-400 hover:bg-amber-300 disabled:opacity-30 text-black text-[13px] font-medium rounded-xl"
        >
          {status === 'busy' ? '…' : 'Report ROI'}
        </button>

        <StatusPanel status={status} message={message} />
      </div>
    </div>
  );
}
