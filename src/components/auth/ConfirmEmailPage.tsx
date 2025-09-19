import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export function ConfirmEmailPage() {
  const [status, setStatus] = useState<'loading'|'ok'|'error'>('loading');
  const [message, setMessage] = useState('Confirmando seu e-mail...');
  const setAuth = useAuthStore();

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');

        if (code) {
          // Fluxo PKCE moderno: troca code por sessão
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error || !data.session) throw error || new Error('Sem sessão');
        } else {
          // Fallback para links antigos com hash #access_token=...
          const hash = new URLSearchParams(window.location.hash.substring(1));
          const access_token = hash.get('access_token');
          const refresh_token = hash.get('refresh_token');
          const type = hash.get('type');
          if (type !== 'signup' || !access_token || !refresh_token) {
            throw new Error('Link inválido ou expirado.');
          }
          const { error: sessionErr } = await supabase.auth.setSession({
            access_token,
            refresh_token
          });
          if (sessionErr) throw sessionErr;
        }

        const { data: sessionRes } = await supabase.auth.getSession();
        const session = sessionRes.session;
        if (!session?.user) throw new Error('Usuário não encontrado após confirmar.');

        // Buscar perfil
        const { getUserProfile } = await import('../../services/database');
        const profile = await getUserProfile(session.user.id);

        useAuthStore.setState({
          user: {
            id: session.user.id,
            email: profile.email,
            name: profile.full_name,
            type: profile.user_type,
            profile: {}
          },
          token: session.access_token,
          isAuthenticated: true,
          error: null,
          loading: false
        });

        setStatus('ok');
        setMessage('E-mail confirmado! Redirecionando...');
        setTimeout(() => {
          window.location.replace('/');
        }, 1200);
      } catch (err: any) {
        console.error(err);
        setStatus('error');
        setMessage(err?.message || 'Falha ao confirmar o e-mail.');
      }
    })();
  }, []);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-md w-full text-center p-8">
        {status === 'loading' && <Loader2 className="mx-auto animate-spin" />}
        {status === 'ok' && <CheckCircle className="mx-auto" />}
        {status === 'error' && <AlertCircle className="mx-auto" />}
        <p className="mt-4 text-lg">{message}</p>
      </div>
    </div>
  );
}
