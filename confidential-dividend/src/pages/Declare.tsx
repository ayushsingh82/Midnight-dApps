import { useState } from 'react';
import { useWalletStore } from '../hooks/useWallet';
import { deriveRoleKey } from '../hooks/useIdentity';
import { PRIVATE_STATE_ID } from '../hooks/wallet/wallet.constants';
import { buildProviders, loadCompiledContract } from '../lib/midnight';
import { createDividendPrivateState } from './witnesses';
import { StatusPanel, StepHeader, type TxStatus } from '../components/ui/StatusPanel';

export function DeclarePage() {
  const { connectedApi, addresses } = useWalletStore();
  const [topUp, setTopUp] = useState('1000000');
  const [rate, setRate] = useState('250');
  const [status, setStatus] = useState<TxStatus>('idle');
  const [message, setMessage] = useState('');

  const call = async (mode: 'topup' | 'declare') => {
    if (!connectedApi || !addresses) return;
    const contractAddress = localStorage.getItem('div_contract');
    if (!contractAddress) {
      setStatus('error');
      setMessage('No deployed contract found.');
      return;
    }
    setStatus('busy');
    setMessage('Deriving issuer identity…');
    try {
      const issuerSk = await deriveRoleKey(addresses.shieldedCoinPublicKey, 'issuer');

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
        setMessage(`Topping up dividend pool with ${topUp}…`);
        await txInterface.topUpDividendPool(BigInt(topUp));
        setStatus('success');
        setMessage(`Pool topped up by ${topUp}.`);
      } else {
        setMessage(`Declaring per-share dividend ${rate}…`);
        await txInterface.declareCycleDividend(BigInt(rate));
        setStatus('success');
        setMessage(`Dividend rate of ${rate}/share declared. Shareholders can now claim.`);
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
        step={3}
        total={4}
        title="Declare dividend"
        description="Top up the on-chain pool and set the per-share rate for the next cycle. Both are public — only recipients stay hidden."
      />

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-5">
        <Field label="Pool top-up amount" value={topUp} onChange={setTopUp} />
        <button
          onClick={() => call('topup')}
          disabled={status === 'busy'}
          className="w-full py-2.5 bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-white text-[13px] font-medium rounded-xl disabled:opacity-30"
        >
          {status === 'busy' ? '…' : 'Top up pool'}
        </button>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-5">
        <Field label="Per-share dividend rate" value={rate} onChange={setRate} />
        <button
          onClick={() => call('declare')}
          disabled={status === 'busy'}
          className="w-full py-2.5 bg-violet-400 hover:bg-violet-300 text-black text-[13px] font-medium rounded-xl disabled:opacity-30"
        >
          {status === 'busy' ? '…' : 'Declare dividend'}
        </button>
      </div>

      <StatusPanel status={status} message={message} />
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
