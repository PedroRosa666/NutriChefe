/*
  # Proteger assinaturas contra auto-concessão de Premium

  Problema:
    A policy "Users can update their own subscriptions" deixava qualquer usuário
    logado fazer UPDATE na própria linha de `user_subscriptions` direto pelo
    client (chave anon), mudando `status`, `plan_id` e `expires_at`. Ou seja,
    era possível ativar o plano Premium sem pagar.

  Correção:
    - Remove a policy de UPDATE. Quem altera assinaturas é só o webhook do
      Stripe (Edge Function com service role, que ignora RLS).
    - Os usuários continuam podendo ler (SELECT) a própria assinatura.
*/

DROP POLICY IF EXISTS "Users can update their own subscriptions" ON user_subscriptions;
