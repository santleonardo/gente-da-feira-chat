/**
 * Sanitização de HTML segura para SSR + cliente.
 * DOMPurify é carregado dinamicamente apenas no browser,
 * evitando erros de "window is not defined" no servidor.
 */

type DOMPurifyType = typeof import("dompurify");
let purify: DOMPurifyType | null = null;

const ALLOWED: Parameters<DOMPurifyType["sanitize"]>[1] = {
  ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "br", "p", "span", "u", "s"],
  ALLOWED_ATTR: ["href", "target", "rel", "class"],
};

export async function sanitizeHTMLAsync(html: string): Promise<string> {
  if (typeof window === "undefined") {
    // Servidor: strip all tags
    return html.replace(/<[^>]+>/g, "");
  }
  if (!purify) {
    const mod = await import("dompurify");
    purify = mod.default;
  }
  return purify.sanitize(html, ALLOWED) as string;
}

/**
 * Versão síncrona — só usar quando DOMPurify já foi carregado antes.
 * Fallback seguro (strip tags) se ainda não estiver disponível.
 */
export function sanitizeHTMLSync(html: string): string {
  if (typeof window === "undefined" || !purify) {
    return html.replace(/<[^>]+>/g, "");
  }
  return purify.sanitize(html, ALLOWED) as string;
}
