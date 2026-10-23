import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { reportError } from '../../lib/error-reporting';
import { isStaleBuildError, reloadForNewBuild } from '../../lib/stale-build';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Fica fora do i18n de propósito: esta tela aparece justamente quando o app quebrou.
const TEXT = {
  pt: { title: 'Algo deu errado', hint: 'Recarregue a página para continuar. Se continuar acontecendo, tente de novo em alguns minutos.', button: 'Recarregar', home: 'Ir para o início' },
  en: { title: 'Something went wrong', hint: 'Reload the page to continue. If it keeps happening, try again in a few minutes.', button: 'Reload', home: 'Go to home' },
};

function language(): 'pt' | 'en' {
  try {
    const saved = JSON.parse(localStorage.getItem('settings') ?? '{}')?.state?.language;
    if (saved === 'en' || saved === 'pt') return saved;
  } catch {
    /* sem configuração salva */
  }
  return navigator.language?.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

/** Tela de erro geral (também usada pelo roteador). */
export function ErrorScreen() {
  const t = TEXT[language()];
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <span className="mx-auto mb-3 inline-flex rounded-full bg-rose-50 p-3 text-rose-500 dark:bg-rose-500/10">
          <AlertTriangle className="h-7 w-7" />
        </span>
        <h1 className="mb-1 text-lg font-semibold text-slate-900 dark:text-white">{t.title}</h1>
        <p className="mb-5 text-sm text-slate-600 dark:text-slate-300">{t.hint}</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            <RefreshCw className="h-4 w-4" />
            {t.button}
          </button>
          <a href="/" className="text-sm font-medium text-slate-500 hover:text-emerald-700 dark:text-slate-400">
            {t.home}
          </a>
        </div>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Versão antiga do app pedindo um arquivo que não existe mais: recarrega e pronto.
    if (isStaleBuildError(error) && reloadForNewBuild()) return;
    console.error('Uncaught error:', error, errorInfo);
    reportError(error, 'render');
  }

  public render() {
    if (this.state.hasError) return <ErrorScreen />;

    return this.props.children;
  }
}
