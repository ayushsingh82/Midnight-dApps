import { useState } from 'react';
import { useWalletStore } from '../hooks/useWallet';
import { deriveKey, deriveKeyFromPassword } from '../lib/utils';
import { CONTRACT_PATH, INDEXER_HTTP, INDEXER_WS, PROOF_SERVER, PRIVATE_STATE_ID } from '../hooks/wallet/wallet.constants';
import { createRealEstatePrivateState, witnesses } from './witnesses';

export function DeployPage() {
  const { isConnected, connectedApi, addresses, userPassword } = useWalletStore();
  const [status, setStatus] = useState<string>('');
  const [deployed, setDeployed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const deploy = async () => {
    if (!connectedApi || !addresses || !userPassword) return;
    setBusy(true);
    setStatus('Deriving sponsor identity...');
    try {
      const master = await deriveKeyFromPassword(userPassword, addresses.shieldedCoinPublicKey);
      const sponsorSk = await deriveKey(master, 'realestate:sponsor');

      setStatus('Loading compiled contract...');
      const contractModule: any = await import(/* @vite-ignore */ `${CONTRACT_PATH}/managed/realestate/contract/index.js`);

      setStatus('Setting up providers...');
      const { indexerPublicDataProvider } = await import('@midnight-ntwrk/midnight-js-indexer-public-data-provider');
      const { levelPrivateStateProvider } = await import('@midnight-ntwrk/midnight-js-level-private-state-provider');
      const { FetchZkConfigProvider } = await import('@midnight-ntwrk/midnight-js-fetch-zk-config-provider');
      const { httpClientProofProvider } = await import('@midnight-ntwrk/midnight-js-http-client-proof-provider');
      const { deployContract } = await import('@midnight-ntwrk/midnight-js-contracts');
      const { CompiledContract } = await import('@midnight-ntwrk/compact-js');
      const { Transaction } = await import('@midnight-ntwrk/ledger-v8');

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
            const toHex = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
            const fromHex = (h: string) => new Uint8Array((h.match(/.{2}/g) || []).map((b) => parseInt(b, 16)));
            const serializedTx = toHex(tx.serialize());
            const received = await connectedApi.balanceUnsealedTransaction(serializedTx);
            return Transaction.deserialize('signature', 'proof', 'binding', fromHex(received.tx));
          },
        },
        midnightProvider: {
          submitTx: async (tx: any) => {
            const toHex = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
            await connectedApi.submitTransaction(toHex(tx.serialize()));
            return tx.identifiers()?.[0] ?? '';
          },
        },
      };

      setStatus('Compiling contract instance...');
      const cc = CompiledContract.make('realestate', contractModule.Contract);
      const ccW = CompiledContract.withWitnesses(cc, witnesses as any);
      const finalContract = CompiledContract.withCompiledFileAssets(ccW, `${CONTRACT_PATH}/managed/realestate`);

      setStatus('Submitting deploy transaction...');
      const result: any = await deployContract(providers, {
        compiledContract: finalContract,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: createRealEstatePrivateState(sponsorSk),
        args: [sponsorSk],
      });

      const addr = result.deployTxData.public.contractAddress;
      localStorage.setItem('re_contract', addr);
      setDeployed(addr);
      setStatus('Deployed successfully');
    } catch (e: any) {
      console.error(e);
      setStatus(`Error: ${e?.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  if (!isConnected) {
    return <div className="text-center py-20 text-white/40">Connect a wallet to deploy.</div>;
  }
  if (!userPassword) {
    return <div className="text-center py-20 text-white/40">Unlock your investor vault on the home page first.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight">Deploy Property Contract</h1>
        <p className="text-[13px] text-white/30 mt-1">
          The deployer becomes the property sponsor. The sponsor secret key is derived deterministically from your password + wallet, so it can be recovered without on-chain storage.
        </p>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
        <p className="text-[10px] uppercase tracking-[0.1em] text-white/30">Sponsor identity</p>
        <p className="text-[13px] text-white/60">
          Wallet: <span className="font-mono text-white/80">{addresses?.shieldedCoinPublicKey.slice(0, 16)}…</span>
        </p>
        <button
          onClick={deploy}
          disabled={busy}
          className="w-full py-3 bg-white hover:bg-white/90 disabled:opacity-30 text-black text-[13px] font-medium rounded-xl"
        >
          {busy ? 'Deploying…' : 'Deploy Contract'}
        </button>
        {status && <p className="text-[12px] text-white/40 font-mono">{status}</p>}
        {deployed && (
          <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
            <p className="text-[11px] uppercase text-emerald-300/70">Contract Address</p>
            <p className="font-mono text-[12px] text-emerald-200 break-all mt-1">{deployed}</p>
          </div>
        )}
      </div>
    </div>
  );
}
