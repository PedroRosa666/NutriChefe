import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ThemeProvider } from './components/ThemeProvider';
import './index.css';
import { installGlobalErrorReporting } from './lib/error-reporting';
import { listenForInstallPrompt, registerServiceWorker } from './lib/push';
import { installStaleBuildRecovery } from './lib/stale-build';

// Endereço oficial sem "www": login, links dos e-mails e volta do pagamento usam um endereço só.
const CANONICAL_HOST = 'nutrichef.app.br';

if (window.location.hostname === `www.${CANONICAL_HOST}`) {
  window.location.replace(`https://${CANONICAL_HOST}${window.location.pathname}${window.location.search}${window.location.hash}`);
} else {
  installStaleBuildRecovery();
  installGlobalErrorReporting();
  registerServiceWorker();
  listenForInstallPrompt();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </ErrorBoundary>
    </StrictMode>
  );
}