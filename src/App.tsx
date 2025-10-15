import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import LoadingGate from './components/common/LoadingGate';
import { Header } from './components/Header';
import { Toast } from './components/common/Toast';
import { useAuthStore } from './store/auth';
import { useToastStore } from './store/toast';
import { useRecipesStore } from './store/recipes';
import { useEffect, useState } from 'react';

function App() {
  const [initialized, setInitialized] = useState(false);
  const { initializeAuth } = useAuthStore();
  const { fetchRecipes } = useRecipesStore();
  const { message, type, hideToast } = useToastStore();

  useEffect(() => {
    const init = async () => {
      try {
        await initializeAuth();
        await fetchRecipes();
      } finally {
        setInitialized(true);
      }
    };
    init();
  }, [initializeAuth, fetchRecipes]);

  return (
    <LoadingGate initialized={initialized} minDurationMs={4000} appName="NutriChef">
      <BrowserRouter>
        <Header />
        <AppRoutes />
        {message && <Toast message={message} type={type} onClose={hideToast} />}
      </BrowserRouter>
    </LoadingGate>
  );
}

export default App;
