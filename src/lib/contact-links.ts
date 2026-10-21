// Links de contato montados a partir de texto digitado pelo nutricionista.
// Nunca usar o valor cru em href: "javascript:..." executaria script em quem clicar.

/** Só aceita http(s); sem protocolo, assume https. Retorna null se inválido. */
export function safeWebsiteUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/** wa.me exige o número com DDI; números brasileiros sem DDI recebem 55. */
export function whatsappUrl(value: string, message?: string): string | null {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (digits.length < 12 || digits.length > 15) return null;
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

export function phoneUrl(value: string): string | null {
  const digits = value.replace(/[^\d+]/g, '');
  return digits.length >= 8 ? `tel:${digits}` : null;
}

export function instagramUrl(value: string): string | null {
  const handle = value.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').split(/[/?#]/)[0];
  return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? `https://instagram.com/${handle}` : null;
}
