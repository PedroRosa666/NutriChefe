import { Outlet } from 'react-router-dom';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { ThemeProvider } from '../components/ThemeProvider';

export function RootLayout() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <Outlet />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
