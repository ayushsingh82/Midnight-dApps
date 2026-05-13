import { useState } from 'react';
import { useWalletStore } from '../hooks/useWallet';
import { deriveRoleKey } from '../hooks/useIdentity';
import { hexToUint8Array } from '../lib/utils';
import { CONTRACT_PATH, INDEXER_HTTP, INDEXER_WS, PROOF_SERVER, PRIVATE_STATE_ID } from '../hooks/wallet/wallet.constants';
import { createRealEstatePrivateState, witnesses } from './witnesses';
import { StatusPanel, StepHeader, type TxStatus } from '../components/ui/StatusPanel';

export function IssuePage() {
  const { connectedApi, addresses } = useWalletStore();
  const [holderCommit, setHolderCommit] = useState('');
  const [status, setStatus] = useState<TxStatus>('idle');
  const [message, setMessage] = useState('');

  const validCommit = /^[0-9a-fA-F]{64}$/.test(holderCommit.trim());

  const issue = async () => {
    if (!connectedApi || !addresses) return;
    const contractAddress = localStorage.getItem('re_contract');
    if (!contractAddress) {
      setStatus('error');
      setMessage('No deployed contract. Deploy first on the Deploy page.');
      return;
    }
    if (!validCommit) {
      setStatus('error');
      setMessage('Commitment must be 64 hex characters (32 bytes).');
      return;
    }
    setStatus('busy');
    setMessage('Deriving sponsor identity…');
    try {
      const sponsorSk = await deriveRoleKey(addresses.shieldedCoinPublicKey, 'sponsor');

      const contractPath = CONTRACT_PATH + '/managed/realestate' + '/contract/index.js';
      const contractModule: any = await import(/* @vite-ignore */ contractPath);
      const { indexerPublicDataProvider } = await import('@midnight-ntwrk/midnight-js-indexer-public-data-provider');
      const { levelPrivateStateProvider } = await import('@midnight-ntwrk/midnight-js-level-private-state-provider');
      const { FetchZkConfigProvider } = await import('@midnight-ntwrk/midnight-js-fetch-zk-config-provider');
      const { httpClientProofProvider } = await import('@midnight-ntwrk/midnight-js-http-client-proof-provider');
      const { findDeployedContract, createCircuitCallTxInterface } = await import('@midnight-ntwrk/midnight-js-contracts');
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

      const cc = CompiledContract.make('realestate', contractModule.Contract);
      const ccW = CompiledContract.withWitnesses(cc, witnesses as any);
      const finalContract = CompiledContract.withCompiledFileAssets(ccW, `${CONTRACT_PATH}/managed/realestate`);

      setMessage('Connecting to deployed contract…');
      await findDeployedContract(providers as never, {
        contractAddress,
        compiledContract: finalContract as never,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: createRealEstatePrivateState(sponsorSk),
      });

      const txInterface: any = createCircuitCallTxInterface(providers as never, finalContract as never, contractAddress, PRIVATE_STATE_ID);

      setMessage('Generating ZK proof and submitting…');
      await txInterface.issueShare(hexToUint8Array(holderCommit.trim()));
      setStatus('success');
      setMessage('Share issued. The investor commitment is now in the ownership Merkle tree.');
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
        total={3}
        title="Issue shares"
        description="Only the sponsor can call this. The ledger learns a new commitment was added — never whose."
      />

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] uppercase tracking-widest text-white/30">Holder commitment</label>
            <span className={`text-[10px] uppercase tracking-widest ${validCommit ? 'text-emerald-300/70' : 'text-white/20'}`}>
              {validCommit ? '✓ 64 hex' : `${holderCommit.length}/64 hex`}
            </span>
          </div>
          <input
            type="text"
            value={holderCommit}
            onChange={(e) => setHolderCommit(e.target.value)}
            placeholder="abc123…"
            className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white font-mono text-[12px] focus:outline-none focus:border-white/20 transition-colors"
          />
          <p className="text-[11px] text-white/30 mt-2">
            The investor generates this on the Home page and shares it with you off-chain.
          </p>
        </div>

        <button
          onClick={issue}
          disabled={status === 'busy' || !validCommit}
          className="w-full py-3 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-30 disabled:cursor-not-allowed text-black text-[13px] font-medium rounded-xl transition-colors"
        >
          {status === 'busy' ? 'Submitting…' : 'Issue share'}
        </button>

        <StatusPanel status={status} message={message} />
      </div>
    </div>
  );
}
