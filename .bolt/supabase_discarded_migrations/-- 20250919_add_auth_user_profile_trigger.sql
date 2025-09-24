-- 20250919_add_auth_user_profile_trigger.sql

-- Função para criar perfil ao novo usuário no auth.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, user_type, email, avatar_url, bio)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Novo usuário'),
    coalesce(new.raw_user_meta_data->>'user_type', 'Client'),
    new.email,
    null,
    null
  )
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

-- Trigger que roda após insert em auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
