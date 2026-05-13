import { useState } from 'react';
import { useWalletStore } from '../hooks/useWallet';
import { deriveRoleKey } from '../hooks/useIdentity';
import { CONTRACT_PATH, INDEXER_HTTP, INDEXER_WS, PROOF_SERVER, PRIVATE_STATE_ID } from '../hooks/wallet/wallet.constants';
import { createRealEstatePrivateState, witnesses } from './witnesses';
import { StatusPanel, StepHeader, type TxStatus } from '../components/ui/StatusPanel';

export function DeployPage() {
  const { connectedApi, addresses } = useWalletStore();
  const [status, setStatus] = useState<TxStatus>('idle');
  const [message, setMessage] = useState('');
  const [deployed, setDeployed] = useState<string | null>(null);

  const deploy = async () => {
    if (!connectedApi || !addresses) return;
    setStatus('busy');
    setMessage('Deriving sponsor identity…');
    try {
      const sponsorSk = await deriveRoleKey(addresses.shieldedCoinPublicKey, 'sponsor');

      setMessage('Loading compiled contract…');
      const contractPath = CONTRACT_PATH + '/managed/realestate' + '/contract/index.js';
      const contractModule: any = await import(/* @vite-ignore */ contractPath);

      setMessage('Setting up providers…');
      const { indexerPublicDataProvider } = await import('@midnight-ntwrk/midnight-js-indexer-public-data-provider');
      const { levelPrivateStateProvider } = await import('@midnight-ntwrk/midnight-js-level-private-state-provider');
      const { FetchZkConfigProvider } = await import('@midnight-ntwrk/midnight-js-fetch-zk-config-provider');
      const { httpClientProofProvider } = await import('@midnight-ntwrk/midnight-js-http-client-proof-provider');
      const { deployContract } = await import('@midnight-ntwrk/midnight-js-contracts');
      const { CompiledContract } = await import('@midnight-ntwrk/compact-js');
      const { Transaction } = await import('@midnight-ntwrk/ledger-v8');

      const toHex = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
      const fromHex = (h: string) => new Uint8Array((h.match(/.{2}/g) || []).map((b) => parseInt(b, 16)));

      const zkConfig = new FetchZkConfigProvider(`${CONTRACT_PATH}/managed/realestate/keys`, fetch.bind(window));
      const providers: any = {
        privateStateProvider: levelPrivateStateProvider({ privateStateStoreName: 'realestate' }),
        publicDataProvider: indexerPublicDataProvider(INDEXER_HTTP, INDEXER_WS),
        zkConfigProvider: zkConfig,
        proofProvider: httpClientProofProvider(PROOF_SERVER, zkConfig as any),
        walletProvider: {
          getCoinPublicKey: () => addresses.shieldedCoinPublicKey,
          getEncryptionPublicKey: () => addresses.shieldedEncryptionPublicKey,
          balanceTx: async (tx: any) => {
            const received = await connectedApi.balanceUnsealedTransaction(toHex(tx.serialize()));
            return Transaction.deserialize('signature', 'proof', 'binding', fromHex(received.tx));
          },
        },
        midnightProvider: {
          submitTx: async (tx: any) => {
            await connectedApi.submitTransaction(toHex(tx.serialize()));
            return tx.identifiers()?.[0] ?? '';
          },
        },
      };

      setMessage('Compiling contract instance…');
      const cc = CompiledContract.make('realestate', contractModule.Contract);
      const ccW = CompiledContract.withWitnesses(cc, witnesses as any);
      const finalContract = CompiledContract.withCompiledFileAssets(ccW, `${CONTRACT_PATH}/managed/realestate`);

      setMessage('Submitting deploy transaction…');
      const result: any = await deployContract(providers, {
        compiledContract: finalContract,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: createRealEstatePrivateState(sponsorSk),
        args: [sponsorSk],
      } as any);

      const addr = result.deployTxData.public.contractAddress;
      localStorage.setItem('re_contract', addr);
      setDeployed(addr);
      setStatus('success');
      setMessage('Deployed successfully. You are now the property sponsor.');
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
        total={3}
        title="Deploy property contract"
        description="The deploying wallet becomes the property sponsor. Sponsor identity is derived deterministically from your wallet — no separate password needed."
      />

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-5">
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-white/30 mb-2">Sponsor wallet</label>
          <p className="text-[12px] font-mono text-white/70 break-all bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2.5">
            {addresses?.unshieldedAddress || '—'}
          </p>
        </div>

        <button
          onClick={deploy}
          disabled={status === 'busy' || !!deployed}
          className="w-full py-3 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-30 disabled:cursor-not-allowed text-black text-[13px] font-medium rounded-xl transition-colors"
        >
          {status === 'busy' ? 'Deploying…' : deployed ? 'Deployed' : 'Deploy contract'}
        </button>

        <StatusPanel status={status} message={message} />

        {deployed && (
          <div className="px-4 py-3 bg-emerald-500/[0.06] border border-emerald-500/[0.18] rounded-xl">
            <p className="text-[10px] uppercase tracking-widest text-emerald-300/70 mb-1">Contract address</p>
            <p className="font-mono text-[12px] text-emerald-100 break-all">{deployed}</p>
          </div>
        )}
      </div>
    </div>
  );
}
