import { useState } from 'react';
import { useWalletStore } from '../hooks/useWallet';
import { deriveKey, deriveKeyFromPassword, hexToUint8Array } from '../lib/utils';
import { PRIVATE_STATE_ID } from '../hooks/wallet/wallet.constants';
import { buildProviders, loadCompiledContract } from '../lib/midnight';
import { createDividendPrivateState } from './witnesses';

export function RegisterPage() {
  const { isConnected, connectedApi, addresses, userPassword } = useWalletStore();
  const [holderCommit, setHolderCommit] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const register = async () => {
    if (!connectedApi || !addresses || !userPassword) return;
    const contractAddress = localStorage.getItem('div_contract');
    if (!contractAddress) {
      setStatus('No deployed contract found.');
      return;
    }
    if (!/^[0-9a-fA-F]{64}$/.test(holderCommit.trim())) {
      setStatus('Commitment must be 64 hex chars (32 bytes)');
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

      setStatus('Connecting to deployed contract...');
      await findDeployedContract(providers as any, {
        contractAddress,
        compiledContract: finalContract as any,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: createDividendPrivateState(issuerSk),
      });

      const txInterface: any = createCircuitCallTxInterface(providers as any, finalContract as any, contractAddress, PRIVATE_STATE_ID);

      setStatus('Registering shareholder commitment...');
      await txInterface.registerShareholder(hexToUint8Array(holderCommit.trim()));
      setStatus('Shareholder registered. Commitment is now in the cap-table Merkle tree.');
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
        <h1 className="text-[24px] font-semibold tracking-tight">Register Shareholder</h1>
        <p className="text-[13px] text-white/30 mt-1">
          Only the issuer can call this. The ledger learns that *some* commitment was added — never which wallet it belongs to.
        </p>
      </div>
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
        <label className="block text-[11px] uppercase tracking-widest text-white/30">Shareholder commitment (hex)</label>
        <input
          type="text"
          value={holderCommit}
          onChange={(e) => setHolderCommit(e.target.value)}
          placeholder="abc..."
          className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white font-mono text-[12px] focus:outline-none focus:border-white/20"
        />
        <button onClick={register} disabled={busy} className="w-full py-3 bg-white hover:bg-white/90 disabled:opacity-30 text-black text-[13px] font-medium rounded-xl">
          {busy ? 'Submitting…' : 'Register'}
        </button>
        {status && <p className="text-[12px] text-white/50 font-mono">{status}</p>}
      </div>
    </div>
  );
}
