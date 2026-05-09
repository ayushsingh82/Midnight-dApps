import { useState } from 'react';
import { useWalletStore } from '../hooks/useWallet';
import { deriveKey, deriveKeyFromPassword, padTo32Bytes } from '../lib/utils';
import { CONTRACT_PATH, INDEXER_HTTP, INDEXER_WS, PROOF_SERVER, PRIVATE_STATE_ID } from '../hooks/wallet/wallet.constants';
import { createRealEstatePrivateState, witnesses } from './witnesses';

export function ClaimPage() {
  const { isConnected, connectedApi, addresses, userPassword } = useWalletStore();
  const [propertyId, setPropertyId] = useState('LDN-COVENT-001');
  const [cycle, setCycle] = useState('2026-Q2');
  const [amount, setAmount] = useState('1000');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const claim = async (mode: 'prove' | 'yield') => {
    if (!connectedApi || !addresses || !userPassword) return;
    const contractAddress = localStorage.getItem('re_contract');
    if (!contractAddress) {
      setStatus('No deployed contract found.');
      return;
    }
    setBusy(true);
    setStatus('Deriving investor identity...');
    try {
      const master = await deriveKeyFromPassword(userPassword, addresses.shieldedCoinPublicKey);
      const investorSk = await deriveKey(master, 'realestate:investor');

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
        privateStateProvider: levelPrivateStateProvider({ privateStateStoreName: 'realestate-investor' }),
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

      await findDeployedContract(providers, {
        contractAddress,
        compiledContract: finalContract as any,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: createRealEstatePrivateState(investorSk),
      });

      const txInterface: any = createCircuitCallTxInterface(providers, finalContract as any, contractAddress, PRIVATE_STATE_ID);

      if (mode === 'prove') {
        setStatus('Generating ZK ownership proof...');
        await txInterface.proveOwnership(padTo32Bytes(propertyId));
        setStatus('Ownership proven. The chain knows nothing about you except that someone valid called.');
      } else {
        setStatus('Generating yield-claim proof...');
        await txInterface.claimYield(padTo32Bytes(propertyId), padTo32Bytes(cycle), BigInt(amount));
        setStatus(`Yield of ${amount} claimed for cycle ${cycle}. Nullifier prevents double-claim.`);
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
        <h1 className="text-[24px] font-semibold tracking-tight">Claim Yield</h1>
        <p className="text-[13px] text-white/30 mt-1">
          Prove ownership or claim a rental cycle. Both run on the same ownership Merkle path — the chain learns that <em>some</em> owner acted, never which one.
        </p>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Property" value={propertyId} onChange={setPropertyId} />
          <Field label="Cycle" value={cycle} onChange={setCycle} />
          <Field label="Amount" value={amount} onChange={setAmount} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => claim('prove')} disabled={busy} className="py-3 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white text-[13px] font-medium rounded-xl disabled:opacity-30">
            {busy ? '…' : 'Prove Ownership'}
          </button>
          <button onClick={() => claim('yield')} disabled={busy} className="py-3 bg-emerald-400 hover:bg-emerald-300 text-black text-[13px] font-medium rounded-xl disabled:opacity-30">
            {busy ? '…' : 'Claim Yield'}
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
