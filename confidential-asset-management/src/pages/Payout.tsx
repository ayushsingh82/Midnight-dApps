import { useState } from 'react';
import { useWalletStore } from '../hooks/useWallet';
import { deriveKey, deriveKeyFromPassword, padTo32Bytes } from '../lib/utils';
import { PRIVATE_STATE_ID } from '../hooks/wallet/wallet.constants';
import { buildProviders, loadCompiledContract } from '../lib/midnight';
import { createFundPrivateState } from './witnesses';

export function PayoutPage() {
  const { isConnected, connectedApi, addresses, userPassword } = useWalletStore();
  const [fundId, setFundId] = useState('GLOBAL-MACRO-I');
  const [period, setPeriod] = useState('2026-05');
  const [amount, setAmount] = useState('60000');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const call = async (mode: 'prove' | 'claim') => {
    if (!connectedApi || !addresses || !userPassword) return;
    const contractAddress = localStorage.getItem('fund_contract');
    if (!contractAddress) {
      setStatus('No deployed contract found.');
      return;
    }
    setBusy(true);
    setStatus('Deriving LP identity...');
    try {
      const master = await deriveKeyFromPassword(userPassword, addresses.shieldedCoinPublicKey);
      const lpSk = await deriveKey(master, 'fund:lp');

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
        setStatus('Proving LP membership without claim...');
        await txInterface.proveLp(padTo32Bytes(fundId));
        setStatus('LP membership proven privately.');
      } else {
        setStatus(`Claiming payout of ${amount}...`);
        await txInterface.claimPayout(padTo32Bytes(fundId), padTo32Bytes(period), BigInt(amount));
        setStatus(`Payout of ${amount} claimed for period ${period}. Nullifier locked.`);
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
        <h1 className="text-[24px] font-semibold tracking-tight">LP Payout</h1>
        <p className="text-[13px] text-white/30 mt-1">
          Prove you're an LP, or claim the period's payout. The chain learns the amount and that *some* LP claimed — never which one.
        </p>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Fund" value={fundId} onChange={setFundId} />
          <Field label="Period" value={period} onChange={setPeriod} />
          <Field label="Amount" value={amount} onChange={setAmount} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => call('prove')} disabled={busy} className="py-3 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white text-[13px] font-medium rounded-xl disabled:opacity-30">
            {busy ? '…' : 'Prove LP'}
          </button>
          <button onClick={() => call('claim')} disabled={busy} className="py-3 bg-amber-400 hover:bg-amber-300 text-black text-[13px] font-medium rounded-xl disabled:opacity-30">
            {busy ? '…' : 'Claim Payout'}
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
