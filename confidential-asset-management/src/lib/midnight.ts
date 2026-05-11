import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { CONTRACT_PATH, INDEXER_HTTP, INDEXER_WS, PROOF_SERVER } from '../hooks/wallet/wallet.constants';

export async function buildProviders(opts: {
  connectedApi: ConnectedAPI;
  shieldedCoinPublicKey: string;
  shieldedEncryptionPublicKey: string;
  privateStateStoreName: string;
}) {
  const { indexerPublicDataProvider } = await import('@midnight-ntwrk/midnight-js-indexer-public-data-provider');
  const { levelPrivateStateProvider } = await import('@midnight-ntwrk/midnight-js-level-private-state-provider');
  const { FetchZkConfigProvider } = await import('@midnight-ntwrk/midnight-js-fetch-zk-config-provider');
  const { httpClientProofProvider } = await import('@midnight-ntwrk/midnight-js-http-client-proof-provider');
  const { Transaction } = await import('@midnight-ntwrk/ledger-v8');

  const toHex = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
  const fromHex = (h: string) => new Uint8Array((h.match(/.{2}/g) || []).map((b) => parseInt(b, 16)));

  const zkConfig = new FetchZkConfigProvider(`${CONTRACT_PATH}/managed/fund/keys`, fetch.bind(window));

  return {
    privateStateProvider: levelPrivateStateProvider({ privateStateStoreName: opts.privateStateStoreName }),
    publicDataProvider: indexerPublicDataProvider(INDEXER_HTTP, INDEXER_WS),
    zkConfigProvider: zkConfig,
    proofProvider: httpClientProofProvider(PROOF_SERVER, zkConfig as any),
    walletProvider: {
      getCoinPublicKey: () => opts.shieldedCoinPublicKey,
      getEncryptionPublicKey: () => opts.shieldedEncryptionPublicKey,
      balanceTx: async (tx: any) => {
        const received = await opts.connectedApi.balanceUnsealedTransaction(toHex(tx.serialize()));
        return Transaction.deserialize('signature', 'proof', 'binding', fromHex(received.tx));
      },
    },
    midnightProvider: {
      submitTx: async (tx: any) => {
        await opts.connectedApi.submitTransaction(toHex(tx.serialize()));
        return tx.identifiers()?.[0] ?? '';
      },
    },
  };
}

export async function loadCompiledContract() {
  const { CompiledContract } = await import('@midnight-ntwrk/compact-js');
  const contractModule: any = await import(/* @vite-ignore */ `${CONTRACT_PATH}/managed/fund/contract/index.js`);
  const { witnesses } = await import('../pages/witnesses');
  const cc = CompiledContract.make('fund', contractModule.Contract);
  const ccW = CompiledContract.withWitnesses(cc, witnesses as any);
  return {
    contractModule,
    finalContract: CompiledContract.withCompiledFileAssets(ccW, `${CONTRACT_PATH}/managed/fund`),
  };
}
