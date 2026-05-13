import { useState } from 'react';
import { useWalletStore } from '../hooks/useWallet';
import { deriveRoleKey } from '../hooks/useIdentity';
import { PRIVATE_STATE_ID } from '../hooks/wallet/wallet.constants';
import { buildProviders, loadCompiledContract } from '../lib/midnight';
import { createDividendPrivateState } from './witnesses';
import { StatusPanel, StepHeader, type TxStatus } from '../components/ui/StatusPanel';

export function DeployPage() {
  const { connectedApi, addresses } = useWalletStore();
  const [status, setStatus] = useState<TxStatus>('idle');
  const [message, setMessage] = useState('');
  const [deployed, setDeployed] = useState<string | null>(null);

  const deploy = async () => {
    if (!connectedApi || !addresses) return;
    setStatus('busy');
    setMessage('Deriving issuer identity…');
    try {
      const issuerSk = await deriveRoleKey(addresses.shieldedCoinPublicKey, 'issuer');

      setMessage('Setting up providers…');
      const providers = await buildProviders({
        connectedApi,
        shieldedCoinPublicKey: addresses.shieldedCoinPublicKey,
        shieldedEncryptionPublicKey: addresses.shieldedEncryptionPublicKey,
        privateStateStoreName: 'dividend',
      });

      setMessage('Loading compiled contract…');
      const { finalContract } = await loadCompiledContract();
      const { deployContract } = await import('@midnight-ntwrk/midnight-js-contracts');

      setMessage('Submitting deploy transaction…');
      const result: any = await deployContract(providers as any, {
        compiledContract: finalContract,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: createDividendPrivateState(issuerSk),
        args: [issuerSk],
      });

      const addr = result.deployTxData.public.contractAddress;
      localStorage.setItem('div_contract', addr);
      setDeployed(addr);
      setStatus('success');
      setMessage('Deployed. You are now the issuer.');
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setMessage(e?.message || String(e));
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <StepHeader
        step={1}
        total={4}
        title="Deploy dividend contract"
        description="The deploying wallet becomes the corporate issuer. Issuer identity is derived deterministically from your wallet — no separate password."
      />

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-5">
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-white/30 mb-2">Issuer wallet</label>
          <p className="text-[12px] font-mono text-white/70 break-all bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2.5">
            {addresses?.unshieldedAddress || '—'}
          </p>
        </div>

        <button
          onClick={deploy}
          disabled={status === 'busy' || !!deployed}
          className="w-full py-3 bg-violet-400 hover:bg-violet-300 disabled:opacity-30 disabled:cursor-not-allowed text-black text-[13px] font-medium rounded-xl"
        >
          {status === 'busy' ? 'Deploying…' : deployed ? 'Deployed' : 'Deploy contract'}
        </button>

        <StatusPanel status={status} message={message} />

        {deployed && (
          <div className="px-4 py-3 bg-violet-500/[0.08] border border-violet-500/[0.2] rounded-xl">
            <p className="text-[10px] uppercase tracking-widest text-violet-200/70 mb-1">Contract address</p>
            <p className="font-mono text-[12px] text-violet-100 break-all">{deployed}</p>
          </div>
        )}
      </div>
    </div>
  );
}
