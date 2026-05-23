/**
 * Sanitização de HTML segura para SSR + cliente.
 * DOMPurify é carregado dinamicamente apenas no browser,
 * evitando erros de "window is not defined" no servidor.
 */

import DOMPurify from "dompurify";

const ALLOWED: { ALLOWED_TAGS: string[]; ALLOWED_ATTR: string[] } = {
  ALLOWED_TAGS: [
    "b", "i", "em", "strong", "a", "br", "p", "span", "u", "s",
    "h1", "h2", "h3", "font", "div", "ul", "ol", "li", "blockquote",
  ],
  ALLOWED_ATTR: [
    "href", "target", "rel", "class", "style", "color",
    "face", "size", "align",
  ],
};

let loaded = false;

export async function sanitizeHTMLAsync(html: string): Promise<string> {
  if (typeof window === "undefined") {
    // Servidor: strip all tags
    return html.replace(/<[^>]+>/g, "");
  }
  if (!loaded) {
    // DOMPurify auto-initializes on import in browser
    loaded = true;
  }
  return DOMPurify.sanitize(html, ALLOWED) as string;
}

/**
 * Versão síncrona — só usar quando DOMPurify já foi carregado antes.
 * Fallback seguro (strip tags) se ainda não estiver disponível.
 */
export function sanitizeHTMLSync(html: string): string {
  if (typeof window === "undefined" || !loaded) {
    return html.replace(/<[^>]+>/g, "");
  }
  return DOMPurify.sanitize(html, ALLOWED) as string;
}
