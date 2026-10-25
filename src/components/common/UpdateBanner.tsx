import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Versão do contrato com o banco que este app entende. Sobe junto com a migração que muda o formato
 * dos dados (a função app_min_client() do banco devolve a mínima aceita).
 * 3: refeições personalizadas (20261106120000_custom_meals.sql).
 */
export const CLIENT_CONTRACT = 3;

// Confere ao abrir e ao voltar para o app, no máximo a cada 10 minutos.
const CHECK_EVERY_MS = 10 * 60_000;

/**
 * Aviso de app desatualizado: quem deixou o app aberto desde antes de uma mudança no formato dos
 * dados vê o pedido para atualizar, em vez de uma tela que esconde refeições novas.
 */
export function UpdateBanner() {
  const t = useTranslation();
  const [outdated, setOutdated] = useState(false);

  useEffect(() => {
    let last = 0;
    const check = async () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < CHECK_EVERY_MS) return;
      last = Date.now();
      const { data, error } = await supabase.rpc('app_min_client');
      if (!error && Number(data) > CLIENT_CONTRACT) setOutdated(true);
    };
    check();
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);

  if (!outdated) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-3 bg-sky-600 px-4 py-2 text-sm text-white">
      <span>{t.common.updateAvailable}</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1 font-semibold hover:bg-white/25"
      >
        <RefreshCw className="h-4 w-4" />
        {t.common.updateNow}
      </button>
    </div>
  );
}
