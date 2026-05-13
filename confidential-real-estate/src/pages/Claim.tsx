import { useState } from 'react';
import { useWalletStore } from '../hooks/useWallet';
import { deriveRoleKey } from '../hooks/useIdentity';
import { padTo32Bytes } from '../lib/utils';
import { CONTRACT_PATH, INDEXER_HTTP, INDEXER_WS, PROOF_SERVER, PRIVATE_STATE_ID } from '../hooks/wallet/wallet.constants';
import { createRealEstatePrivateState, witnesses } from './witnesses';
import { StatusPanel, StepHeader, type TxStatus } from '../components/ui/StatusPanel';

export function ClaimPage() {
  const { connectedApi, addresses } = useWalletStore();
  const [propertyId, setPropertyId] = useState('LDN-COVENT-001');
  const [cycle, setCycle] = useState('2026-Q2');
  const [amount, setAmount] = useState('1000');
  const [status, setStatus] = useState<TxStatus>('idle');
  const [message, setMessage] = useState('');

  const run = async (mode: 'prove' | 'yield') => {
    if (!connectedApi || !addresses) return;
    const contractAddress = localStorage.getItem('re_contract');
    if (!contractAddress) {
      setStatus('error');
      setMessage('No deployed contract found.');
      return;
    }
    setStatus('busy');
    setMessage('Deriving investor identity…');
    try {
      const investorSk = await deriveRoleKey(addresses.shieldedCoinPublicKey, 'investor');

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
        privateStateProvider: levelPrivateStateProvider({ privateStateStoreName: 'realestate-investor' }),
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

      await findDeployedContract(providers as never, {
        contractAddress,
        compiledContract: finalContract as never,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: createRealEstatePrivateState(investorSk),
      });

      const txInterface: any = createCircuitCallTxInterface(providers as never, finalContract as never, contractAddress, PRIVATE_STATE_ID);

      if (mode === 'prove') {
        setMessage('Generating ZK ownership proof…');
        await txInterface.proveOwnership(padTo32Bytes(propertyId));
        setStatus('success');
        setMessage('Ownership proven. The chain learns nothing about you except that a valid owner acted.');
      } else {
        setMessage('Generating yield-claim proof…');
        await txInterface.claimYield(padTo32Bytes(propertyId), padTo32Bytes(cycle), BigInt(amount));
        setStatus('success');
        setMessage(`Yield of ${amount} claimed for cycle ${cycle}. Nullifier prevents a second claim this cycle.`);
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
        step={3}
        total={3}
        title="Prove ownership or claim yield"
        description="Both calls run on the same ownership Merkle path. The chain learns some owner acted — never which one."
      />

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Property" value={propertyId} onChange={setPropertyId} />
          <Field label="Cycle" value={cycle} onChange={setCycle} />
          <Field label="Amount" value={amount} onChange={setAmount} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => run('prove')}
            disabled={status === 'busy'}
            className="py-3 bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-white text-[13px] font-medium rounded-xl transition-colors disabled:opacity-30"
          >
            {status === 'busy' ? '…' : 'Prove ownership'}
          </button>
          <button
            onClick={() => run('yield')}
            disabled={status === 'busy'}
            className="py-3 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-30 text-black text-[13px] font-medium rounded-xl transition-colors"
          >
            {status === 'busy' ? '…' : 'Claim yield'}
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
        className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-[13px] focus:outline-none focus:border-white/20 transition-colors"
      />
    </div>
  );
}
