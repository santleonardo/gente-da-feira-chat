/**
 * Rate limiting simples em memória.
 * Em produção com múltiplas instâncias, substitua por Upstash Redis:
 * https://github.com/upstash/ratelimit
 *
 * Para usar Upstash, instale: npm install @upstash/ratelimit @upstash/redis
 * e adicione ao .env: UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Limpar entradas expiradas a cada 5 minutos
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) store.delete(key);
    }
  }, 5 * 60 * 1000);
}

/**
 * Verifica o rate limit para uma chave (geralmente IP).
 * @param key   Identificador (IP, user_id, etc.)
 * @param limit Número máximo de requests no período
 * @param windowMs Janela em milissegundos (padrão: 60s)
 */
export function checkRateLimitInMemory(
  key: string,
  limit = 20,
  windowMs = 60_000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

/**
 * Helper para usar nos Route Handlers do Next.js.
 * Retorna um Response 429 se o limite foi atingido, ou null se pode prosseguir.
 */
export function applyRateLimit(
  req: Request,
  limit = 20,
  windowMs = 60_000
): Response | null {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "anonymous";

  const { allowed, remaining, resetAt } = checkRateLimitInMemory(
    ip,
    limit,
    windowMs
  );

  if (!allowed) {
    return new Response(
      JSON.stringify({ error: "Muitas requisições. Tente novamente em breve." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
          "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  return null;
}
