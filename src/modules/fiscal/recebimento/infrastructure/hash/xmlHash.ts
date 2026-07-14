/**
 * Hash SHA-256 canônico do XML para deduplicação. Normaliza whitespace
 * entre tags para tornar o hash resiliente a diferenças de formatação
 * cosmética. **Não** substitui uma validação de assinatura digital — é
 * apenas o discriminador de duplicidade estável.
 *
 * Client-safe: usa `crypto.subtle.digest`, disponível em browser, Deno
 * e Node ≥ 20 (jsdom no vitest).
 */
function normalize(xml: string): string {
  return xml.replace(/>\s+</g, '><').trim();
}

export async function computeXmlHash(xml: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalize(xml));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const arr = Array.from(new Uint8Array(digest));
  return arr.map((b) => b.toString(16).padStart(2, '0')).join('');
}