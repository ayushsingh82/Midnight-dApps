import { useState } from 'react';
import { useWalletStore } from '../hooks/useWallet';
import { deriveKey, deriveKeyFromPassword, padTo32Bytes } from '../lib/utils';
import { PRIVATE_STATE_ID } from '../hooks/wallet/wallet.constants';
import { buildProviders, loadCompiledContract } from '../lib/midnight';
import { createDividendPrivateState } from './witnesses';

export function ClaimPage() {
  const { isConnected, connectedApi, addresses, userPassword } = useWalletStore();
  const [classId, setClassId] = useState('COMMON-A');
  const [cycle, setCycle] = useState('2026-Q2');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const call = async (mode: 'prove' | 'claim') => {
    if (!connectedApi || !addresses || !userPassword) return;
    const contractAddress = localStorage.getItem('div_contract');
    if (!contractAddress) {
      setStatus('No deployed contract found.');
      return;
    }
    setBusy(true);
    setStatus('Deriving shareholder identity...');
    try {
      const master = await deriveKeyFromPassword(userPassword, addresses.shieldedCoinPublicKey);
      const shareholderSk = await deriveKey(master, 'dividend:shareholder');

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
        setStatus('Generating eligibility proof...');
        await txInterface.proveEligibility(padTo32Bytes(classId));
        setStatus('Eligibility proven without revealing identity.');
      } else {
        setStatus('Claiming dividend...');
        await txInterface.claimDividend(padTo32Bytes(classId), padTo32Bytes(cycle));
        setStatus(`Dividend claimed for cycle ${cycle}. Nullifier locked.`);
      }
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
        <h1 className="text-[24px] font-semibold tracking-tight">Claim Dividend</h1>
        <p className="text-[13px] text-white/30 mt-1">
          Prove you're a shareholder, or claim the current cycle's declared dividend. The nullifier prevents double-claims.
        </p>
      </div>
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Share class" value={classId} onChange={setClassId} />
          <Field label="Cycle" value={cycle} onChange={setCycle} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => call('prove')} disabled={busy} className="py-3 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white text-[13px] font-medium rounded-xl disabled:opacity-30">
            {busy ? '…' : 'Prove Eligibility'}
          </button>
          <button onClick={() => call('claim')} disabled={busy} className="py-3 bg-violet-400 hover:bg-violet-300 text-black text-[13px] font-medium rounded-xl disabled:opacity-30">
            {busy ? '…' : 'Claim Dividend'}
          </button>
        </div>

        {status && <p className="text-[12px] text-white/50 font-mono">{status}</p>}
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
