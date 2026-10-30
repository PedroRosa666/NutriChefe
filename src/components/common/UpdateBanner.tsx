import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTranslation } from '../../hooks/useTranslation';
import { CLIENT_CONTRACT, updateCheck } from '../../lib/client-contract';

// Confere ao abrir e ao voltar para o app, no máximo a cada 10 minutos.
const CHECK_EVERY_MS = 10 * 60_000;

/** Contrato do site no ar (gerado no build); null quando não dá para ler. */
async function publishedContract(): Promise<number | null> {
  try {
    const res = await fetch('/version.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const contract = Number((await res.json())?.contract);
    return Number.isFinite(contract) ? contract : null;
  } catch {
    return null;
  }
}

/**
 * Aviso de app desatualizado: quem deixou o app aberto desde antes de uma mudança no formato dos
 * dados vê o pedido para atualizar, em vez de uma tela que esconde refeições novas. Só aparece
 * quando o site no ar já tem a versão que o banco pede, então "Atualizar" sempre resolve.
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
      if (error || Number(data) <= CLIENT_CONTRACT) return;
      const published = await publishedContract();
      const result = updateCheck(Number(data), published);
      if (result === 'reload') setOutdated(true);
      if (result === 'deploy_behind') {
        console.error(
          `[NutriChef] O banco pede o contrato ${Number(data)}, mas o site no ar publica ${published ?? 'desconhecido'}: publique o app.`
        );
      }
    };
    check();
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);

  if (!outdated) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-3 bg-sky-700 px-4 py-2 text-sm text-white">
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
