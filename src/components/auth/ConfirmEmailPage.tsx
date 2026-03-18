import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function ConfirmEmailPage() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('Confirmando seu e-mail...');
  const { initializeAuth } = useAuthStore();

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);

        const code = url.searchParams.get('code');
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (data?.user) {
            await initializeAuth();
            setStatus('ok');
            setMessage('E-mail confirmado com sucesso! Redirecionando...');
            setTimeout(() => { window.location.href = '/'; }, 2500);
            return;
          }
        }

        if (window.location.hash.includes('access_token')) {
          const hash = new URLSearchParams(window.location.hash.substring(1));
          const access_token = hash.get('access_token') || '';
          const refresh_token = hash.get('refresh_token') || '';
          if (access_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) throw error;
            await initializeAuth();
            setStatus('ok');
            setMessage('E-mail confirmado com sucesso! Redirecionando...');
            setTimeout(() => { window.location.href = '/'; }, 2500);
            return;
          }
        }

        const token_hash = url.searchParams.get('token_hash');
        const type = (url.searchParams.get('type') || 'signup') as any;
        if (token_hash) {
          const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });
          if (error) throw error;
          if (data?.user) {
            await initializeAuth();
            setStatus('ok');
            setMessage('E-mail confirmado com sucesso! Redirecionando...');
            setTimeout(() => { window.location.href = '/'; }, 2500);
            return;
          }
        }

        setStatus('error');
        setMessage('Link inválido ou expirado. Solicite um novo e-mail de confirmação.');
      } catch (err: any) {
        setStatus('error');
        const friendly = err?.message?.includes('expired')
          ? 'Seu link expirou. Solicite um novo e-mail de confirmação.'
          : 'Não foi possível confirmar seu e-mail. Tente novamente.';
        setMessage(friendly);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-8 text-center shadow-xl border border-slate-100 dark:border-slate-800"
      >
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-emerald-600" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">
              Confirmando e-mail...
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Aguarde um momento.</p>
          </>
        )}

        {status === 'ok' && (
          <>
            <div className="mx-auto w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-5">
              <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-3">
              E-mail confirmado!
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">{message}</p>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mb-6">
              <motion.div
                className="bg-emerald-600 h-1.5 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 2.5 }}
              />
            </div>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="w-full py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition font-semibold text-sm"
            >
              Ir para o início agora
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-5">
              <AlertCircle className="w-8 h-8 text-red-500 dark:text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-3">
              Falha na confirmação
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">{message}</p>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="w-full py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition font-semibold text-sm"
            >
              Voltar ao início
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
