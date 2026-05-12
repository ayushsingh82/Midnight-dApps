import { useState } from 'react';
import { useWalletStore } from '../hooks/useWallet';
import { deriveKey, deriveKeyFromPassword } from '../lib/utils';
import { PRIVATE_STATE_ID } from '../hooks/wallet/wallet.constants';
import { buildProviders, loadCompiledContract } from '../lib/midnight';
import { createFundPrivateState } from './witnesses';

export function ReportPage() {
  const { isConnected, connectedApi, addresses, userPassword } = useWalletStore();
  const [roi, setRoi] = useState('1200');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const report = async () => {
    if (!connectedApi || !addresses || !userPassword) return;
    const contractAddress = localStorage.getItem('fund_contract');
    if (!contractAddress) {
      setStatus('No deployed contract found.');
      return;
    }
    setBusy(true);
    setStatus('Deriving manager identity...');
    try {
      const master = await deriveKeyFromPassword(userPassword, addresses.shieldedCoinPublicKey);
      const managerSk = await deriveKey(master, 'fund:manager');

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

      setStatus(`Reporting ROI of ${roi}bp...`);
      await txInterface.reportRoi(BigInt(roi));
      setStatus(`ROI reported. Anyone can now verify ${roi}bp on-chain — the strategy stays private.`);
    } catch (e: any) {
      console.error(e);
      setStatus(`Error: ${e?.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  if (!isConnected) return <div className="text-center py-20 text-white/40">Connect a wallet.</div>;
  if (!userPassword) return <div className="text-center py-20 text-white/40">Unlock vault on Home.</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight">Report ROI</h1>
        <p className="text-[13px] text-white/30 mt-1">
          Publish the period's ROI in basis points (e.g. 1200 = +12.00%). Public on-chain; strategy details remain private off-chain.
        </p>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
        <label className="block text-[11px] uppercase tracking-widest text-white/30">ROI (basis points)</label>
        <input
          type="text"
          value={roi}
          onChange={(e) => setRoi(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-[13px] focus:outline-none focus:border-white/20"
        />
        <button onClick={report} disabled={busy} className="w-full py-3 bg-amber-400 hover:bg-amber-300 disabled:opacity-30 text-black text-[13px] font-medium rounded-xl">
          {busy ? '…' : 'Report ROI'}
        </button>
        {status && <p className="text-[12px] text-white/50 font-mono">{status}</p>}
      </div>
    </div>
  );
}
