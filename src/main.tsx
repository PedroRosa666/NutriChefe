import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ThemeProvider } from './components/ThemeProvider';
import './index.css';
import { installGlobalErrorReporting } from './lib/error-reporting';
import { listenForInstallPrompt, registerServiceWorker } from './lib/push';
import { installStaleBuildRecovery } from './lib/stale-build';

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