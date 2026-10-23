// Service worker do NutriChef: abre sem internet e recebe notificações.
//
// Cache:
// - /assets/* (arquivos com hash no nome): do cache primeiro; nunca mudam.
// - Páginas: da rede primeiro; sem internet, a última versão do app (index.html).
// - Leituras do Supabase do plano, receitas, alimentos e trocas: da rede primeiro; sem internet,
//   a última resposta guardada (o plano abre offline). Esse cache é apagado ao sair da conta.
//
// Ao publicar mudanças neste arquivo, aumente VERSION: os caches antigos são descartados.
const VERSION = 'v2';
const APP_CACHE = `nutrichef-app-${VERSION}`;
const DATA_CACHE = 'nutrichef-data';
const OFFLINE_TABLES = ['meal_plans', 'recipes', 'foods', 'food_swap_requests', 'shopping_lists', 'nutrition_goals'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => cache.addAll(['/', '/manifest.webmanifest', '/icon-192.png']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('nutrichef-app-') && k !== APP_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isOfflineData = (url) =>
  url.pathname.startsWith('/rest/v1/') && OFFLINE_TABLES.includes(url.pathname.split('/')[3]);

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(fallbackUrl ?? request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(fallbackUrl ?? request);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // Arquivo de uma versão antiga já removido: o servidor devolve a página (HTML) no lugar.
  // Não guarda, senão o app ficaria preso nesse erro até limpar o cache.
  const isHtml = (response.headers.get('content-type') || '').includes('text/html');
  if (response.ok && !isHtml) (await caches.open(APP_CACHE)).put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') {
      // Todas as rotas são o mesmo app: guarda e devolve sempre como "/".
      event.respondWith(networkFirst(request, APP_CACHE, '/'));
    } else if (url.pathname.startsWith('/assets/')) {
      event.respondWith(cacheFirst(request));
    }
    return;
  }

  if (url.hostname.endsWith('.supabase.co') && isOfflineData(url)) {
    event.respondWith(networkFirst(request, DATA_CACHE));
  }
});

// O app avisa quando a pessoa sai da conta: nada dela pode ficar guardado no aparelho.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'logout') event.waitUntil(caches.delete(DATA_CACHE));
});

// Notificação enviada pelo servidor (função send-push do Supabase).
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'NutriChef', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || '/' },
    })
  );
});

// Toque na notificação: foca o app aberto (e navega) ou abre um novo.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const open = clients.find((c) => new URL(c.url).origin === self.location.origin);
      if (!open) return self.clients.openWindow(target);
      // O app aberto navega sozinho (sem recarregar). navigate() falha em janelas que o
      // service worker ainda não controla: por isso a mensagem vem primeiro.
      const url = new URL(target);
      open.postMessage({ type: 'navigate', url: url.pathname + url.search });
      try {
        await open.focus();
      } catch {
        /* alguns navegadores não deixam focar */
      }
    })
  );
});
