import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

/**
 * Página de confirmação de email.
 * Trata todos os formatos possíveis do Supabase:
 *  - ?code=...                                 → exchangeCodeForSession
 *  - #access_token=...&refresh_token=...       → setSession
 *  - ?token_hash=...&type=signup               → verifyOtp (legado)
 */
export default function ConfirmEmailPage() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('Confirmando seu e-mail...');

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
            setMessage('E-mail confirmado com sucesso! Você já pode acessar o sistema.');
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
            setMessage('E-mail confirmado com sucesso! Você já pode acessar o sistema.');
            return;
          }
        }

        // 3) Legado (?token_hash=...&type=signup)
        const token_hash = url.searchParams.get('token_hash');
        const type = (url.searchParams.get('type') || 'signup') as any;
        if (token_hash) {
          const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });
          if (error) throw error;
          if (data?.user) {
            setStatus('ok');
            setMessage('E-mail confirmado com sucesso! Você já pode acessar o sistema.');
            return;
          }
        }

        setStatus('error');
        setMessage('Link inválido ou expirado. Solicite um novo e-mail de confirmação.');
      } catch (err: any) {
        console.error('Erro ao confirmar e-mail:', err);
        setStatus('error');
        const friendly = err?.message?.includes('expired')
          ? 'Seu link expirou. Solicite um novo e-mail de confirmação.'
          : 'Não foi possível confirmar seu e-mail. Tente novamente.';
        setMessage(friendly);
      }
    })();
  }, []);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-md w-full text-center p-8">
        {status === 'loading' && <Loader2 className="mx-auto animate-spin" />}
        {status === 'ok' && <CheckCircle className="mx-auto text-green-600" />}
        {status === 'error' && <AlertCircle className="mx-auto text-red-600" />}
        <p className="mt-4 text-lg">{message}</p>
      </div>
    </div>
  );
}
