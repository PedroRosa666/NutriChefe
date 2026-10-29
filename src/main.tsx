import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ThemeProvider } from './components/ThemeProvider';
import './index.css';
import { installGlobalErrorReporting } from './lib/error-reporting';
import { listenForInstallPrompt, registerServiceWorker } from './lib/push';
import { installStaleBuildRecovery } from './lib/stale-build';

// Endereço oficial: login, links dos e-mails e volta do pagamento usam um endereço só. Quem chega
// pelo "www", pelo endereço antigo do workers.dev ou por http é levado a https://nutrichef.app.br.
const CANONICAL_HOST = 'nutrichef.app.br';
const OTHER_HOSTS = [`www.${CANONICAL_HOST}`, 'app.nutrichefe.workers.dev'];
const { hostname, protocol } = window.location;

if (OTHER_HOSTS.includes(hostname) || (hostname === CANONICAL_HOST && protocol === 'http:')) {
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