import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { UpdateToast } from './components/UpdateToast';
import { initInstallPrompt } from './pwa/install';
import { initServiceWorker } from './pwa/updates';
import { AppStore } from './state/store';
import './styles.css';

initInstallPrompt();
initServiceWorker();

const store = new AppStore();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App store={store} extra={<UpdateToast />} />
  </StrictMode>,
);
