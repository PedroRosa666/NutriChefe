-- Correção de dados (não muda o esquema).

-- 1) Contas criadas antes do gatilho on_auth_user_created (jun-ago/2025) ficaram sem linha em
--    profiles. Elas entram no app, mas qualquer gravação falha nas chaves estrangeiras para
--    profiles (inclusive o registro em client_errors, por isso o erro não aparecia).
--    Mesma lógica de handle_new_user.
INSERT INTO public.profiles (id, email, full_name, user_type, created_at)
SELECT u.id,
       u.email,
       COALESCE(u.raw_user_meta_data->>'full_name', ''),
       COALESCE(u.raw_user_meta_data->>'user_type', 'Client'),
       u.created_at
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- 2) Conversas de IA sem nenhuma mensagem: o app gravava a conversa ao abrir, antes da
--    primeira pergunta. O histórico já as escondia; agora a conversa só é criada no envio.
DELETE FROM public.ai_conversations c
WHERE c.created_at < now() - interval '1 hour'
  AND NOT EXISTS (SELECT 1 FROM public.ai_messages m WHERE m.conversation_id = c.id);
