// Worker do site. Quase tudo continua sendo arquivo estático (o app React); ele só entra antes
// nas rotas de `run_worker_first` (wrangler.jsonc), para quem não roda JavaScript (buscadores,
// leitores de IA, prévias de link) também enxergar o conteúdo:
//   /receita/:id[/:nome] -> página do app com título, descrição, canonical, dados estruturados
//                           (JSON-LD Recipe) e o texto da receita; receita inexistente = 404
//   /                    -> página do app com links para as receitas
//   /sitemap.xml, /robots.txt
// Endereços antigos (www, workers.dev) recebem 301 para o domínio próprio.
// Se o Supabase falhar, devolve a página do app sem os extras: o site nunca fica fora do ar por isso.
import { recipePath } from '../src/lib/recipe-url';

interface Env {
  ASSETS: Fetcher;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

const ORIGIN = 'https://nutrichef.app.br';
const OTHER_HOSTS = ['www.nutrichef.app.br', 'app.nutrichefe.workers.dev'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Dados do Supabase ficam 5 min no cache da Cloudflare (receita editada aparece em seguida). O HTML
// não é guardado: ele aponta para os arquivos do build atual, que somem no deploy seguinte.
const CACHE_SECONDS = 300;

// As proteções de public/_headers não valem para respostas do Worker: repetidas aqui.
const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
};

interface RecipeRow {
  id: string;
  title: string;
  description: string | null;
  image: string | null;
  prep_time: number | null;
  category: string | null;
  rating: number | null;
  review_count: number | null;
  ingredients: unknown;
  instructions: unknown;
  nutrition_facts: Record<string, unknown> | null;
  nutrition_basis: string | null;
  yield_servings: number | null;
  created_at: string | null;
  updated_at: string | null;
  author: { full_name: string | null } | null;
}

const CATEGORY: Record<string, string> = {
  vegan: 'Vegana',
  vegetarian: 'Vegetariana',
  lowCarb: 'Baixo carboidrato',
  highProtein: 'Rica em proteína',
  glutenFree: 'Sem glúten',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (OTHER_HOSTS.includes(url.hostname)) {
      return Response.redirect(`${ORIGIN}${url.pathname}${url.search}`, 301);
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return env.ASSETS.fetch(request);

    if (url.pathname === '/robots.txt') return text(robots(), 'text/plain; charset=utf-8');

    const recipeMatch = url.pathname.match(/^\/receita\/([^/]+)(?:\/[^/]*)?\/?$/);
    if (url.pathname !== '/sitemap.xml' && url.pathname !== '/' && !recipeMatch) return env.ASSETS.fetch(request);

    try {
      if (url.pathname === '/sitemap.xml') return await sitemap(env);
      if (recipeMatch) return await recipePage(request, env, recipeMatch[1]);
      return await homePage(request, env);
    } catch (error) {
      console.error('worker:', (error as Error).message);
      return url.pathname === '/sitemap.xml' ? new Response('Unavailable', { status: 503 }) : shell(request, env);
    }
  },
} satisfies ExportedHandler<Env>;

// ---------------------------------------------------------------------------------------------

async function supabase<T>(env: Env, path: string): Promise<T> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}` },
    signal: AbortSignal.timeout(4000),
    cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
  });
  if (!res.ok) throw new Error(`supabase ${res.status}`);
  return res.json() as Promise<T>;
}

/** index.html do build, como os arquivos estáticos o serviriam (sem If-None-Match: sempre com corpo). */
async function shell(request: Request, env: Env): Promise<Response> {
  return env.ASSETS.fetch(new Request(new URL('/', request.url)));
}

async function recipePage(request: Request, env: Env, id: string): Promise<Response> {
  const rows = UUID_RE.test(id)
    ? await supabase<RecipeRow[]>(
        env,
        `recipes?id=eq.${id}&select=id,title,description,image,prep_time,category,rating,review_count,ingredients,instructions,` +
          'nutrition_facts,nutrition_basis,yield_servings,created_at,updated_at,author:author_card(full_name)'
      )
    : [];
  const recipe = rows[0];
  const page = await shell(request, env);

  // Inexistente, escondida ou só para Premium: 404 com o app (quem tem acesso vê a receita normalmente).
  if (!recipe) {
    return html(
      new HTMLRewriter()
        .on('head', { element: (e) => { e.append('<meta name="robots" content="noindex">', { html: true }); } })
        .transform(page),
      404
    );
  }

  const canonical = `${ORIGIN}${recipePath(recipe)}`;
  const description = clip(recipe.description || `Receita de ${recipe.title} no NutriChef.`, 160);
  const image = httpsUrl(recipe.image);
  return html(
    withMeta(page, {
      title: `${recipe.title} · NutriChef`,
      description,
      canonical,
      image,
      type: 'article',
      jsonLd: recipeJsonLd(recipe, canonical, image),
      body: recipeBody(recipe, image),
    }),
    200
  );
}

async function homePage(request: Request, env: Env): Promise<Response> {
  const recipes = await supabase<{ id: string; title: string }[]>(env, 'recipes?select=id,title&order=created_at.desc&limit=100');
  const links = recipes.map((r) => `<li><a href="${esc(recipePath(r))}">${esc(r.title)}</a></li>`).join('');
  return html(
    withMeta(await shell(request, env), {
      canonical: `${ORIGIN}/`,
      body:
        `<main style="${MAIN_STYLE}"><h1>NutriChef</h1>` +
        '<p>Receitas saudáveis com informação nutricional, diário alimentar, plano semanal e acompanhamento com nutricionista.</p>' +
        `<h2>Receitas</h2><ul>${links}</ul><p><a href="/nutricionistas">Encontre um nutricionista</a></p></main>`,
    }),
    200
  );
}

async function sitemap(env: Env): Promise<Response> {
  const [recipes, nutritionists] = await Promise.all([
    supabase<{ id: string; title: string; updated_at: string | null; created_at: string | null }[]>(
      env,
      'recipes?select=id,title,updated_at,created_at&order=created_at.desc&limit=5000'
    ),
    supabase<{ id: string; updated_at: string | null }[]>(
      env,
      'profiles?select=id,updated_at&user_type=eq.Nutritionist&profile_visibility=eq.public&limit=5000'
    ),
  ]);
  const entry = (loc: string, lastmod?: string | null) =>
    `<url><loc>${esc(loc)}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ''}</url>`;
  const body = [
    entry(`${ORIGIN}/`),
    entry(`${ORIGIN}/nutricionistas`),
    ...recipes.map((r) => entry(`${ORIGIN}${recipePath(r)}`, r.updated_at ?? r.created_at)),
    ...nutritionists.map((n) => entry(`${ORIGIN}/nutricionista/${n.id}`, n.updated_at)),
  ].join('');
  return text(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`,
    'application/xml; charset=utf-8'
  );
}

function robots(): string {
  // Áreas com login ou de uso único não precisam aparecer na busca.
  const privatePaths = ['/perfil', '/admin', '/mentoria-ia', '/reset-password', '/forgot-password', '/confirm-email', '/assinatura/', '/login', '/demo', '/404'];
  return ['User-agent: *', 'Allow: /', ...privatePaths.map((p) => `Disallow: ${p}`), '', `Sitemap: ${ORIGIN}/sitemap.xml`, ''].join('\n');
}

// ---------------------------------------------------------------------------------------------

interface Meta {
  title?: string;
  description?: string;
  canonical: string;
  image?: string | null;
  type?: string;
  jsonLd?: unknown;
  body: string;
}

function withMeta(page: Response, meta: Meta): Response {
  const setContent = (value: string | undefined | null) => ({
    element: (e: Element) => {
      if (value) e.setAttribute('content', value);
    },
  });
  const head: string[] = [`<link rel="canonical" href="${esc(meta.canonical)}">`, `<meta property="og:url" content="${esc(meta.canonical)}">`];
  if (meta.jsonLd) {
    // "<" escapado: o texto da receita não consegue fechar a tag <script>.
    head.push(`<script type="application/ld+json">${JSON.stringify(meta.jsonLd).replace(/</g, '\\u003c')}</script>`);
  }
  let rewriter = new HTMLRewriter()
    .on('meta[name="description"]', setContent(meta.description))
    .on('meta[property="og:title"]', setContent(meta.title))
    .on('meta[property="og:description"]', setContent(meta.description))
    .on('meta[property="og:type"]', setContent(meta.type))
    .on('meta[property="og:image"]', setContent(meta.image))
    .on('meta[name="twitter:card"]', setContent(meta.image ? 'summary_large_image' : null))
    .on('head', { element: (e) => { e.append(head.join(''), { html: true }); } })
    // <noscript>: só quem não roda JavaScript lê (buscadores simples, leitores de IA); no navegador
    // não aparece nem pisca antes do app montar, e o React limpa o #root ao montar.
    .on('div#root', { element: (e) => { e.setInnerContent(`<noscript>${meta.body}</noscript>`, { html: true }); } });
  if (meta.title) rewriter = rewriter.on('title', { element: (e) => { e.setInnerContent(meta.title!); } });
  return rewriter.transform(page);
}

const MAIN_STYLE = 'max-width:720px;margin:0 auto;padding:24px 16px;font-family:system-ui,sans-serif;line-height:1.5;color:#1e293b';

function recipeBody(r: RecipeRow, image: string | null): string {
  const ingredients = strings(r.ingredients);
  const steps = strings(r.instructions);
  const facts = r.nutrition_facts ?? {};
  const nutrients = (
    [
      ['calories', 'Calorias', 'kcal'],
      ['protein', 'Proteína', 'g'],
      ['carbs', 'Carboidratos', 'g'],
      ['fat', 'Gorduras', 'g'],
      ['fiber', 'Fibras', 'g'],
    ] as const
  )
    .filter(([k]) => Number(facts[k]) > 0)
    .map(([k, label, unit]) => `<li>${label}: ${Math.round(Number(facts[k]))} ${unit}</li>`)
    .join('');
  return (
    `<main style="${MAIN_STYLE}"><article>` +
    `<h1>${esc(r.title)}</h1>` +
    (r.author?.full_name ? `<p>Por ${esc(r.author.full_name)}</p>` : '') +
    (r.description ? `<p>${esc(r.description)}</p>` : '') +
    (image ? `<img src="${esc(image)}" alt="${esc(r.title)}" style="max-width:100%;height:auto;border-radius:12px">` : '') +
    (r.prep_time ? `<p>Tempo de preparo: ${r.prep_time} min</p>` : '') +
    (ingredients.length ? `<h2>Ingredientes</h2><ul>${ingredients.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '') +
    (steps.length ? `<h2>Modo de preparo</h2><ol>${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : '') +
    (nutrients ? `<h2>Informação nutricional</h2><ul>${nutrients}</ul>` : '') +
    '<p><a href="/">Mais receitas no NutriChef</a></p></article></main>'
  );
}

function recipeJsonLd(r: RecipeRow, url: string, image: string | null) {
  const facts = r.nutrition_facts ?? {};
  // Nutrientes por porção: só quando o autor escreveu assim (receita inteira não serve ao Google).
  const perServing = !r.nutrition_basis || r.nutrition_basis === 'per_serving' || r.nutrition_basis === 'legacy_unit';
  const n = (k: string) => (Number(facts[k]) > 0 ? Math.round(Number(facts[k])) : null);
  const nutrition = perServing && n('calories')
    ? {
        '@type': 'NutritionInformation',
        calories: `${n('calories')} kcal`,
        ...(n('protein') ? { proteinContent: `${n('protein')} g` } : {}),
        ...(n('carbs') ? { carbohydrateContent: `${n('carbs')} g` } : {}),
        ...(n('fat') ? { fatContent: `${n('fat')} g` } : {}),
        ...(n('fiber') ? { fiberContent: `${n('fiber')} g` } : {}),
      }
    : undefined;
  const reviews = Number(r.review_count) || 0;
  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: r.title,
    url,
    ...(r.description ? { description: r.description } : {}),
    ...(image ? { image: [image] } : {}),
    ...(r.author?.full_name ? { author: { '@type': 'Person', name: r.author.full_name } } : {}),
    ...(r.created_at ? { datePublished: r.created_at.slice(0, 10) } : {}),
    ...(r.prep_time ? { totalTime: `PT${r.prep_time}M` } : {}),
    ...(r.yield_servings ? { recipeYield: `${r.yield_servings} porções` } : {}),
    ...(r.category && CATEGORY[r.category] ? { recipeCategory: CATEGORY[r.category], keywords: CATEGORY[r.category] } : {}),
    recipeIngredient: strings(r.ingredients),
    recipeInstructions: strings(r.instructions).map((text) => ({ '@type': 'HowToStep', text })),
    ...(nutrition ? { nutrition } : {}),
    ...(reviews > 0 && Number(r.rating) > 0
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: Number(r.rating).toFixed(1), ratingCount: reviews } }
      : {}),
  };
}

// ---------------------------------------------------------------------------------------------

function html(body: Response, status: number): Response {
  const headers = new Headers(body.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'no-cache');
  headers.delete('Content-Length');
  headers.delete('ETag');
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  return new Response(body.body, { status, headers });
}

function text(body: string, type: string): Response {
  return new Response(body, {
    headers: { 'Content-Type': type, 'Cache-Control': `public, max-age=${CACHE_SECONDS}`, ...SECURITY_HEADERS },
  });
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v ?? '').trim()).filter(Boolean) : [];
}

function httpsUrl(value: string | null): string | null {
  return value && /^https:\/\//i.test(value) ? value : null;
}

function clip(value: string, max: number): string {
  const s = value.replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
