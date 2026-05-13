import { useState } from 'react';
import { useWalletStore } from '../hooks/useWallet';
import { deriveRoleKey } from '../hooks/useIdentity';
import { hexToUint8Array } from '../lib/utils';
import { PRIVATE_STATE_ID } from '../hooks/wallet/wallet.constants';
import { buildProviders, loadCompiledContract } from '../lib/midnight';
import { createDividendPrivateState } from './witnesses';
import { StatusPanel, StepHeader, type TxStatus } from '../components/ui/StatusPanel';

export function RegisterPage() {
  const { connectedApi, addresses } = useWalletStore();
  const [holderCommit, setHolderCommit] = useState('');
  const [status, setStatus] = useState<TxStatus>('idle');
  const [message, setMessage] = useState('');

  const validCommit = /^[0-9a-fA-F]{64}$/.test(holderCommit.trim());

  const register = async () => {
    if (!connectedApi || !addresses) return;
    const contractAddress = localStorage.getItem('div_contract');
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

      setMessage('Connecting to deployed contract…');
      await findDeployedContract(providers as any, {
        contractAddress,
        compiledContract: finalContract as any,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: createDividendPrivateState(issuerSk),
      });

      const txInterface: any = createCircuitCallTxInterface(providers as any, finalContract as any, contractAddress, PRIVATE_STATE_ID);

      setMessage('Submitting registration transaction…');
      await txInterface.registerShareholder(hexToUint8Array(holderCommit.trim()));
      setStatus('success');
      setMessage('Shareholder registered. The commitment is now in the cap-table Merkle tree.');
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
        title="Register shareholder"
        description="Only the issuer can call this. The ledger learns that some commitment was added — never which wallet it belongs to."
      />

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] uppercase tracking-widest text-white/30">Shareholder commitment</label>
            <span className={`text-[10px] uppercase tracking-widest ${validCommit ? 'text-violet-200/80' : 'text-white/20'}`}>
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
          <p className="text-[11px] text-white/30 mt-2">
            The shareholder generates this on the Home page (using their share class) and sends it to you off-chain.
          </p>
        </div>

        <button
          onClick={register}
          disabled={status === 'busy' || !validCommit}
          className="w-full py-3 bg-violet-400 hover:bg-violet-300 disabled:opacity-30 text-black text-[13px] font-medium rounded-xl"
        >
          {status === 'busy' ? 'Submitting…' : 'Register'}
        </button>

        <StatusPanel status={status} message={message} />
      </div>
    </div>
  );
}
