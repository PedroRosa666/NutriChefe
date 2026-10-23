import { useEffect, useState } from 'react';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { ResendConfirmation } from './ResendConfirmation';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Página de confirmação de email.
 * Trata todos os formatos possíveis do Supabase:
 *  - ?code=...                                 → exchangeCodeForSession
 *  - #access_token=...&refresh_token=...       → setSession
 *  - ?token_hash=...&type=signup               → verifyOtp (legado)
 */
export default function ConfirmEmailPage() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const t = useTranslation();
  // Guarda a chave do texto, para a mensagem acompanhar a troca de idioma.
  const [message, setMessage] = useState<keyof typeof t.feedback.confirmEmail>('confirming');

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);

        // 1) Novo fluxo (?code=...)
        const code = url.searchParams.get('code');
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (data?.user) {
            setStatus('ok');
            setMessage('confirmed');
            return;
          }
        }

        // 2) Fluxo com hash (#access_token=...&refresh_token=...)
        if (window.location.hash.includes('access_token')) {
          const hash = new URLSearchParams(window.location.hash.substring(1));
          const access_token = hash.get('access_token') || '';
          const refresh_token = hash.get('refresh_token') || '';
          if (access_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) throw error;
            setStatus('ok');
            setMessage('confirmed');
            return;
          }
        }

        // 3) Legado (?token_hash=...&type=signup)
        const token_hash = url.searchParams.get('token_hash');
        const type = (url.searchParams.get('type') || 'signup') as EmailOtpType;
        if (token_hash) {
          const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });
          if (error) throw error;
          if (data?.user) {
            setStatus('ok');
            setMessage('confirmed');
            return;
          }
        }

        // 4) O supabase-js lê o #access_token assim que o app abre e apaga o hash da URL,
        //    então quando esta página (carregada sob demanda) monta, a sessão já existe.
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        if (!hashParams.get('error')) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user.email_confirmed_at) {
            setStatus('ok');
            setMessage('confirmed');
            return;
          }
        }

        setStatus('error');
        setMessage('invalidLink');
      } catch (err) {
        console.error('Erro ao confirmar e-mail:', err);
        setStatus('error');
        setMessage(err instanceof Error && err.message.includes('expired') ? 'expired' : 'failed');
      }
    })();
  }, []);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-md w-full text-center p-8">
        {status === 'loading' && <Loader2 className="mx-auto animate-spin" />}
        {status === 'ok' && <CheckCircle className="mx-auto text-green-600" />}
        {status === 'error' && <AlertCircle className="mx-auto text-red-600" />}
        <p className="mt-4 text-lg">{t.feedback.confirmEmail[message]}</p>
        {status === 'error' && (
          <div className="mt-6">
            <ResendConfirmation />
          </div>
        )}
      </div>
    </div>
  );
}
