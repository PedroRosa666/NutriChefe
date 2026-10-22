/*
  # Bucket de fotos das receitas

  - `recipe-images`: público, até 1MB por arquivo (o app comprime para WebP antes de enviar).
  - Cada usuário logado envia e gerencia só a própria pasta (`<user_id>/...`).
  - As fotos antigas, que eram links de outros sites, foram copiadas para `migrated/<recipe_id>.webp`
    pelo script `scripts/migrate-recipe-images.mjs` (com a service role, que ignora estas políticas).
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recipe-images',
  'recipe-images',
  true,
  1048576, -- 1MB
  ARRAY['image/webp', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 1048576,
  allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png'];

DROP POLICY IF EXISTS "Users can upload their own recipe images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own recipe images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own recipe images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view recipe images" ON storage.objects;

CREATE POLICY "Users can upload their own recipe images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'recipe-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own recipe images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'recipe-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'recipe-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own recipe images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'recipe-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Anyone can view recipe images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'recipe-images');
