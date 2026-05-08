import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const {
  PORT = '3001',
  FRONTEND_URL = 'http://localhost:5173',
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  GMAIL_USER,
  GMAIL_APP_PASSWORD,
  RESET_TOKEN_TTL_MINUTES = '15'
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
}

if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  throw new Error('Defina GMAIL_USER e GMAIL_APP_PASSWORD no .env');
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD
  }
});

const app = express();
app.use(cors());
app.use(express.json());

const tokenStore = new Map();
const ttlMs = Number(RESET_TOKEN_TTL_MINUTES) * 60 * 1000;

function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [token, data] of tokenStore.entries()) {
    if (data.expiresAt <= now) tokenStore.delete(token);
  }
}

setInterval(cleanupExpiredTokens, 60 * 1000).unref();

app.post('/api/forgot-password', async (req, res) => {
  try {
    const email = String(req.body?.email || '').toLowerCase().trim();

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();

    // Resposta idêntica para não expor se o email existe.
    const genericResponse = {
      message: 'Se o email existir, enviaremos o link de recuperação em instantes.'
    };

    if (error || !profile?.id) {
      return res.json(genericResponse);
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + ttlMs;

    tokenStore.set(resetToken, { userId: profile.id, email, expiresAt });

    const resetLink = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
    await transporter.sendMail({
      from: `NutriChefe <${GMAIL_USER}>`,
      to: email,
      subject: 'Recuperação de senha - NutriChefe',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
          <h2>Recuperação de senha</h2>
          <p>Recebemos uma solicitação para redefinir sua senha.</p>
          <p>
            <a href="${resetLink}" style="display:inline-block;padding:10px 16px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;">
              Redefinir senha
            </a>
          </p>
          <p>Ou copie e cole este link no navegador:</p>
          <p>${resetLink}</p>
          <p>Este link expira em ${RESET_TOKEN_TTL_MINUTES} minutos.</p>
          <p>Se você não solicitou, ignore este email.</p>
        </div>
      `
    });

    return res.json(genericResponse);
  } catch (err) {
    console.error('forgot-password error:', err);
    return res.status(500).json({ error: 'Erro interno ao solicitar recuperação de senha' });
  }
});

app.post('/api/reset-password', async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.newPassword || '');

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'token e newPassword são obrigatórios' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
    }

    const tokenData = tokenStore.get(token);

    if (!tokenData || tokenData.expiresAt < Date.now()) {
      tokenStore.delete(token);
      return res.status(400).json({ error: 'Token inválido ou expirado' });
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(tokenData.userId, {
      password: newPassword
    });

    if (error) {
      console.error('Supabase updateUserById error:', error);
      return res.status(500).json({ error: 'Não foi possível redefinir a senha' });
    }

    tokenStore.delete(token);
    return res.json({ message: 'Senha redefinida com sucesso' });
  } catch (err) {
    console.error('reset-password error:', err);
    return res.status(500).json({ error: 'Erro interno ao redefinir senha' });
  }
});

app.get('/health', (_, res) => {
  res.json({ ok: true });
});

app.listen(Number(PORT), () => {
  console.log(`Password reset API rodando na porta ${PORT}`);
});
