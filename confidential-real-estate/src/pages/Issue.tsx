import { useState } from 'react';
import { useWalletStore } from '../hooks/useWallet';
import { deriveKey, deriveKeyFromPassword, hexToUint8Array } from '../lib/utils';
import { CONTRACT_PATH, INDEXER_HTTP, INDEXER_WS, PROOF_SERVER, PRIVATE_STATE_ID } from '../hooks/wallet/wallet.constants';
import { createRealEstatePrivateState, witnesses } from './witnesses';

export function IssuePage() {
  const { isConnected, connectedApi, addresses, userPassword } = useWalletStore();
  const [holderCommit, setHolderCommit] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const issue = async () => {
    if (!connectedApi || !addresses || !userPassword) return;
    const contractAddress = localStorage.getItem('re_contract');
    if (!contractAddress) {
      setStatus('No deployed contract found. Deploy first.');
      return;
    }
    if (!/^[0-9a-fA-F]{64}$/.test(holderCommit.trim())) {
      setStatus('Holder commitment must be 64 hex chars (32 bytes)');
      return;
    }
    setBusy(true);
    setStatus('Deriving sponsor identity...');
    try {
      const master = await deriveKeyFromPassword(userPassword, addresses.shieldedCoinPublicKey);
      const sponsorSk = await deriveKey(master, 'realestate:sponsor');

      const contractModule: any = await import(/* @vite-ignore */ `${CONTRACT_PATH}/managed/realestate/contract/index.js`);
      const { indexerPublicDataProvider } = await import('@midnight-ntwrk/midnight-js-indexer-public-data-provider');
      const { levelPrivateStateProvider } = await import('@midnight-ntwrk/midnight-js-level-private-state-provider');
      const { FetchZkConfigProvider } = await import('@midnight-ntwrk/midnight-js-fetch-zk-config-provider');
      const { httpClientProofProvider } = await import('@midnight-ntwrk/midnight-js-http-client-proof-provider');
      const { findDeployedContract, createCircuitCallTxInterface } = await import('@midnight-ntwrk/midnight-js-contracts');
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
            const received = await connectedApi.balanceUnsealedTransaction(toHex(tx.serialize()));
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

      const cc = CompiledContract.make('realestate', contractModule.Contract);
      const ccW = CompiledContract.withWitnesses(cc, witnesses as any);
      const finalContract = CompiledContract.withCompiledFileAssets(ccW, `${CONTRACT_PATH}/managed/realestate`);

      setStatus('Connecting to deployed contract...');
      await findDeployedContract(providers, {
        contractAddress,
        compiledContract: finalContract as any,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: createRealEstatePrivateState(sponsorSk),
      });

      const txInterface: any = createCircuitCallTxInterface(providers, finalContract as any, contractAddress, PRIVATE_STATE_ID);

      setStatus('Submitting issueShare transaction...');
      await txInterface.issueShare(hexToUint8Array(holderCommit.trim()));
      setStatus('Share issued. Investor commitment is now in the Merkle tree.');
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
        <h1 className="text-[24px] font-semibold tracking-tight">Issue Shares to Investor</h1>
        <p className="text-[13px] text-white/30 mt-1">
          Only the sponsor can call this. The on-chain ledger never learns who the investor is — only that *some* commitment was added.
        </p>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
        <label className="block text-[11px] uppercase tracking-widest text-white/30">Holder commitment (hex)</label>
        <input
          type="text"
          value={holderCommit}
          onChange={(e) => setHolderCommit(e.target.value)}
          placeholder="0xabc..."
          className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white font-mono text-[12px] focus:outline-none focus:border-white/20"
        />
        <button onClick={issue} disabled={busy} className="w-full py-3 bg-white hover:bg-white/90 disabled:opacity-30 text-black text-[13px] font-medium rounded-xl">
          {busy ? 'Submitting…' : 'Issue Share'}
        </button>
        {status && <p className="text-[12px] text-white/50 font-mono">{status}</p>}
      </div>
    </div>
  );
}
