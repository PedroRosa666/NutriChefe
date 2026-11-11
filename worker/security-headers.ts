// Proteções enviadas em todas as respostas do site. Fonte única, usada em três lugares:
//   - worker/index.ts: páginas montadas pelo Worker (início e receitas);
//   - vite.config.ts (build): gera o arquivo _headers dos arquivos estáticos;
//   - vite.config.ts (vite preview): os testes de tela locais rodam com a mesma política.
//
// Content-Security-Policy: scripts só do próprio site; rede só o site e o Supabase; imagens de
// qualquer https (fotos de receita). Ao usar um serviço novo no navegador (script, fonte, API),
// inclua o domínio aqui. cloudflareinsights.com é o Web Analytics da Cloudflare, injetado só no site
// publicado: não aparece nos testes locais (conferir com npm run test:e2e:prod depois de mexer).
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cloudflareinsights.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  // O site não abre dentro de iframe de outro domínio (junto com X-Frame-Options).
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

export const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
};
