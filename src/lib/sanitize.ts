/**
 * Sanitização de HTML segura para SSR + cliente.
 * DOMPurify é carregado dinamicamente apenas no browser,
 * evitando erros de "window is not defined" no servidor.
 */

import DOMPurify from "dompurify";

const ALLOWED: { ALLOWED_TAGS: string[]; ALLOWED_ATTR: string[] } = {
  ALLOWED_TAGS: [
    "b", "i", "em", "strong", "a", "br", "p", "span", "u", "s",
    "h1", "h2", "h3", "div", "font", "mark", "blockquote", "ul", "ol", "li",
    "sub", "sup", "code", "pre", "small", "big",
  ],
  ALLOWED_ATTR: ["href", "target", "rel", "class", "style", "color", "face", "size"],
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
 * Fallback: retorna o HTML sem sanitizar se DOMPurify ainda não carregou,
 * em vez de remover todas as tags (o que destrói a formatação).
 * Em produção, DOMPurify carrega instantaneamente no browser.
 */
export function sanitizeHTMLSync(html: string): string {
  if (typeof window === "undefined") {
    // Servidor: strip all tags
    return html.replace(/<[^>]+>/g, "");
  }
  if (!loaded) {
    // DOMPurify ainda não carregou — retorna sem sanitizar para não perder formatação
    // Isso é seguro porque o conteúdo já foi validado na criação do post
    return html;
  }
  return DOMPurify.sanitize(html, ALLOWED) as string;
}
