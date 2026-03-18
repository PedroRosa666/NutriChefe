/*
  # Auto-create profile on user signup

  ## Purpose
  Creates a database trigger that automatically inserts a row into the `profiles`
  table whenever a new user signs up via Supabase Auth. This eliminates the need
  for the frontend to manually call `createUserProfile` after signup.

  ## Changes
  - Adds function `handle_new_user()` that reads full_name and user_type from
    auth.users metadata and inserts into profiles
  - Attaches trigger `on_auth_user_created` on auth.users INSERT
  - Uses `IF NOT EXISTS` guards to be safe on re-runs
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, user_type)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'Client')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
