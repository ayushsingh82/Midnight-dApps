import { useState } from 'react';
import { useWalletStore } from '../hooks/useWallet';
import { deriveKey, deriveKeyFromPassword } from '../lib/utils';
import { PRIVATE_STATE_ID } from '../hooks/wallet/wallet.constants';
import { buildProviders, loadCompiledContract } from '../lib/midnight';
import { createDividendPrivateState } from './witnesses';

export function DeclarePage() {
  const { isConnected, connectedApi, addresses, userPassword } = useWalletStore();
  const [topUp, setTopUp] = useState('1000000');
  const [rate, setRate] = useState('250');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const call = async (mode: 'topup' | 'declare') => {
    if (!connectedApi || !addresses || !userPassword) return;
    const contractAddress = localStorage.getItem('div_contract');
    if (!contractAddress) {
      setStatus('No deployed contract found.');
      return;
    }
    setBusy(true);
    setStatus('Deriving issuer identity...');
    try {
      const master = await deriveKeyFromPassword(userPassword, addresses.shieldedCoinPublicKey);
      const issuerSk = await deriveKey(master, 'dividend:issuer');

      const providers = await buildProviders({
        connectedApi,
        shieldedCoinPublicKey: addresses.shieldedCoinPublicKey,
        shieldedEncryptionPublicKey: addresses.shieldedEncryptionPublicKey,
        privateStateStoreName: 'dividend',
      });
      const { finalContract } = await loadCompiledContract();
      const { findDeployedContract, createCircuitCallTxInterface } = await import('@midnight-ntwrk/midnight-js-contracts');

      await findDeployedContract(providers as any, {
        contractAddress,
        compiledContract: finalContract as any,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: createDividendPrivateState(issuerSk),
      });

      const txInterface: any = createCircuitCallTxInterface(providers as any, finalContract as any, contractAddress, PRIVATE_STATE_ID);

      if (mode === 'topup') {
        setStatus(`Topping up pool with ${topUp}...`);
        await txInterface.topUpDividendPool(BigInt(topUp));
        setStatus('Pool topped up.');
      } else {
        setStatus(`Declaring dividend rate ${rate}/share...`);
        await txInterface.declareCycleDividend(BigInt(rate));
        setStatus('Dividend declared. Shareholders can now claim.');
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
        <h1 className="text-[24px] font-semibold tracking-tight">Declare Dividend</h1>
        <p className="text-[13px] text-white/30 mt-1">
          Top up the on-chain pool and set the per-share rate for the next cycle. Both are public — only the recipients stay hidden.
        </p>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
        <Field label="Pool top-up amount" value={topUp} onChange={setTopUp} />
        <button onClick={() => call('topup')} disabled={busy} className="w-full py-2.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white text-[13px] font-medium rounded-xl disabled:opacity-30">
          {busy ? '…' : 'Top up pool'}
        </button>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
        <Field label="Per-share dividend rate" value={rate} onChange={setRate} />
        <button onClick={() => call('declare')} disabled={busy} className="w-full py-2.5 bg-violet-400 hover:bg-violet-300 text-black text-[13px] font-medium rounded-xl disabled:opacity-30">
          {busy ? '…' : 'Declare dividend'}
        </button>
      </div>

      {status && <p className="text-[12px] text-white/50 font-mono">{status}</p>}
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
