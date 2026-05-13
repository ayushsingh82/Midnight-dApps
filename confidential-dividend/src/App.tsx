import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { RequireWallet } from './components/RequireWallet';
import { HomePage } from './pages/Home';
import { DeployPage } from './pages/Deploy';
import { RegisterPage } from './pages/Register';
import { DeclarePage } from './pages/Declare';
import { ClaimPage } from './pages/Claim';
import { useWalletStore } from './hooks/useWallet';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

setNetworkId('preprod');

const LAST_WALLET_KEY = 'midnight_last_wallet';

function App() {
  const { setWallet, connect, isConnected, wallet } = useWalletStore();

  useEffect(() => {
    const tryAutoConnect = async () => {
      if (isConnected || wallet) return;
      const lastWalletId = localStorage.getItem(LAST_WALLET_KEY);
      if (!lastWalletId || !window.midnight) return;
      const wallets = Object.values(window.midnight) as any[];
      const matching = wallets.find((w) => w.rdns === lastWalletId);
      if (matching) {
        setWallet(matching as any);
        try {
          await connect('preprod');
        } catch {
          localStorage.removeItem(LAST_WALLET_KEY);
        }
      }
    };
    tryAutoConnect();
  }, []);

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/deploy" element={<RequireWallet><DeployPage /></RequireWallet>} />
          <Route path="/register" element={<RequireWallet><RegisterPage /></RequireWallet>} />
          <Route path="/declare" element={<RequireWallet><DeclarePage /></RequireWallet>} />
          <Route path="/claim" element={<RequireWallet><ClaimPage /></RequireWallet>} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
