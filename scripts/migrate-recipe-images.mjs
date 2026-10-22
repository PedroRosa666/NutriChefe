// Copia as fotos das receitas que ainda são links de outros sites para o bucket
// `recipe-images`, já reduzidas (1200px, WebP), e troca o link na tabela `recipes`.
//
// Uso:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-recipe-images.mjs --dry-run
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-recipe-images.mjs
//
// Antes de alterar qualquer coisa, grava os links antigos em scripts/backup-recipe-images-<data>.json.
// Para desfazer: node scripts/migrate-recipe-images.mjs --restore scripts/backup-recipe-images-<data>.json
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const BUCKET = 'recipe-images';
const MAX_WIDTH = 1200;
const QUALITY = 78;
const MAX_DOWNLOAD = 15 * 1024 * 1024;

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const restoreFile = args.includes('--restore') ? args[args.indexOf('--restore') + 1] : null;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const storagePrefix = `${SUPABASE_URL}/storage/v1/object/public/`;

async function restore(file) {
  const backup = JSON.parse(readFileSync(file, 'utf8'));
  for (const { id, image } of backup) {
    const { error } = await supabase.from('recipes').update({ image }).eq('id', id);
    console.log(error ? `ERRO ${id}: ${error.message}` : `restaurada ${id}`);
  }
}

async function download(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
    headers: { 'User-Agent': 'Mozilla/5.0 (NutriChef image migration)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get('content-type') || '';
  if (!type.startsWith('image/')) throw new Error(`não é imagem (${type})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_DOWNLOAD) throw new Error('arquivo grande demais');
  return buffer;
}

async function migrate() {
  const { data: recipes, error } = await supabase.from('recipes').select('id, title, image');
  if (error) throw error;

  const pending = recipes.filter((r) => r.image && !r.image.startsWith(storagePrefix));
  console.log(`${recipes.length} receitas, ${pending.length} com foto externa.`);
  if (pending.length === 0) return;

  if (!dryRun) {
    const backupFile = `scripts/backup-recipe-images-${new Date().toISOString().slice(0, 10)}.json`;
    writeFileSync(backupFile, JSON.stringify(pending.map(({ id, image }) => ({ id, image })), null, 2));
    console.log(`Backup dos links antigos: ${backupFile}`);
  }

  let before = 0;
  let after = 0;
  const failures = [];

  for (const recipe of pending) {
    try {
      const original = await download(recipe.image);
      const webp = await sharp(original)
        .rotate()
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toBuffer();
      before += original.length;
      after += webp.length;

      const kb = (n) => `${Math.round(n / 1024)} KB`;
      if (dryRun) {
        console.log(`[teste] ${recipe.id}: ${kb(original.length)} -> ${kb(webp.length)}`);
        continue;
      }

      const path = `migrated/${recipe.id}.webp`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, webp, { contentType: 'image/webp', cacheControl: '31536000', upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const { error: updateError } = await supabase
        .from('recipes')
        .update({ image: data.publicUrl })
        .eq('id', recipe.id);
      if (updateError) throw updateError;

      console.log(`ok ${recipe.id}: ${kb(original.length)} -> ${kb(webp.length)}`);
    } catch (err) {
      failures.push(recipe.id);
      console.log(`FALHOU ${recipe.id}: ${err.message} (link antigo mantido)`);
    }
  }

  const mb = (n) => (n / 1048576).toFixed(1);
  console.log(`\nTotal: ${mb(before)} MB -> ${mb(after)} MB. Falhas: ${failures.length}.`);
}

if (restoreFile) {
  await restore(restoreFile);
} else {
  await migrate();
}
