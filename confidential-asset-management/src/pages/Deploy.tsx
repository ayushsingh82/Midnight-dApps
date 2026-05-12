import { useState } from 'react';
import { useWalletStore } from '../hooks/useWallet';
import { deriveKey, deriveKeyFromPassword } from '../lib/utils';
import { PRIVATE_STATE_ID } from '../hooks/wallet/wallet.constants';
import { buildProviders, loadCompiledContract } from '../lib/midnight';
import { createFundPrivateState } from './witnesses';

export function DeployPage() {
  const { isConnected, connectedApi, addresses, userPassword } = useWalletStore();
  const [status, setStatus] = useState('');
  const [deployed, setDeployed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const deploy = async () => {
    if (!connectedApi || !addresses || !userPassword) return;
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
      const { deployContract } = await import('@midnight-ntwrk/midnight-js-contracts');

      setStatus('Submitting deploy transaction...');
      const result: any = await deployContract(providers as any, {
        compiledContract: finalContract,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: createFundPrivateState(managerSk),
        args: [managerSk],
      });

      const addr = result.deployTxData.public.contractAddress;
      localStorage.setItem('fund_contract', addr);
      setDeployed(addr);
      setStatus('Fund deployed.');
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
        <h1 className="text-[24px] font-semibold tracking-tight">Deploy Fund</h1>
        <p className="text-[13px] text-white/30 mt-1">
          The deployer becomes the fund manager (GP). Their public key is sealed on-chain.
        </p>
      </div>
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
        <p className="text-[10px] uppercase tracking-[0.1em] text-white/30">Manager identity</p>
        <p className="text-[13px] text-white/60">
          Wallet: <span className="font-mono text-white/80">{addresses?.shieldedCoinPublicKey.slice(0, 16)}…</span>
        </p>
        <button onClick={deploy} disabled={busy} className="w-full py-3 bg-white hover:bg-white/90 disabled:opacity-30 text-black text-[13px] font-medium rounded-xl">
          {busy ? 'Deploying…' : 'Deploy Fund'}
        </button>
        {status && <p className="text-[12px] text-white/40 font-mono">{status}</p>}
        {deployed && (
          <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <p className="text-[11px] uppercase text-amber-300/70">Contract Address</p>
            <p className="font-mono text-[12px] text-amber-200 break-all mt-1">{deployed}</p>
          </div>
        )}
      </div>
    </div>
  );
}
