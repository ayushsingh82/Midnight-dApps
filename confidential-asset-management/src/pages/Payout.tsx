import { useState } from 'react';
import { useWalletStore } from '../hooks/useWallet';
import { deriveRoleKey } from '../hooks/useIdentity';
import { padTo32Bytes } from '../lib/utils';
import { PRIVATE_STATE_ID } from '../hooks/wallet/wallet.constants';
import { buildProviders, loadCompiledContract } from '../lib/midnight';
import { createFundPrivateState } from './witnesses';
import { StatusPanel, StepHeader, type TxStatus } from '../components/ui/StatusPanel';

export function PayoutPage() {
  const { connectedApi, addresses } = useWalletStore();
  const [fundId, setFundId] = useState('GLOBAL-MACRO-I');
  const [period, setPeriod] = useState('2026-05');
  const [amount, setAmount] = useState('60000');
  const [status, setStatus] = useState<TxStatus>('idle');
  const [message, setMessage] = useState('');

  const run = async (mode: 'prove' | 'claim') => {
    if (!connectedApi || !addresses) return;
    const contractAddress = localStorage.getItem('fund_contract');
    if (!contractAddress) {
      setStatus('error');
      setMessage('No deployed contract found.');
      return;
    }
    setStatus('busy');
    setMessage('Deriving LP identity…');
    try {
      const lpSk = await deriveRoleKey(addresses.shieldedCoinPublicKey, 'lp');

      const providers = await buildProviders({
        connectedApi,
        shieldedCoinPublicKey: addresses.shieldedCoinPublicKey,
        shieldedEncryptionPublicKey: addresses.shieldedEncryptionPublicKey,
        privateStateStoreName: 'fund-lp',
      });
      const { finalContract } = await loadCompiledContract();
      const { findDeployedContract, createCircuitCallTxInterface } = await import('@midnight-ntwrk/midnight-js-contracts');

      await findDeployedContract(providers as any, {
        contractAddress,
        compiledContract: finalContract as any,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: createFundPrivateState(lpSk),
      });

      const txInterface: any = createCircuitCallTxInterface(providers as any, finalContract as any, contractAddress, PRIVATE_STATE_ID);

      if (mode === 'prove') {
        setMessage('Proving LP membership…');
        await txInterface.proveLp(padTo32Bytes(fundId));
        setStatus('success');
        setMessage('LP membership proven privately.');
      } else {
        setMessage(`Claiming payout of ${amount}…`);
        await txInterface.claimPayout(padTo32Bytes(fundId), padTo32Bytes(period), BigInt(amount));
        setStatus('success');
        setMessage(`Payout of ${amount} claimed for period ${period}. Nullifier locked.`);
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
        title="LP payout"
        description="Prove you're an LP, or claim the period's payout. The chain learns the amount and that some LP claimed — never which one."
      />

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Fund" value={fundId} onChange={setFundId} />
          <Field label="Period" value={period} onChange={setPeriod} />
          <Field label="Amount" value={amount} onChange={setAmount} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => run('prove')}
            disabled={status === 'busy'}
            className="py-3 bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-white text-[13px] font-medium rounded-xl disabled:opacity-30"
          >
            {status === 'busy' ? '…' : 'Prove LP'}
          </button>
          <button
            onClick={() => run('claim')}
            disabled={status === 'busy'}
            className="py-3 bg-amber-400 hover:bg-amber-300 disabled:opacity-30 text-black text-[13px] font-medium rounded-xl"
          >
            {status === 'busy' ? '…' : 'Claim payout'}
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
