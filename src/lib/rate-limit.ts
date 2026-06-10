/**
 * Rate limiting — Upstash Redis em produção, in-memory em dev.
 *
 * SETUP (uma vez só):
 *   1. Crie conta em https://upstash.com (free tier: 10k req/dia)
 *   2. Crie um banco Redis e copie as credenciais
 *   3. npm install @upstash/ratelimit @upstash/redis
 *   4. Adicione ao .env.local:
 *        UPSTASH_REDIS_REST_URL=https://...upstash.io
 *        UPSTASH_REDIS_REST_TOKEN=...
 *
 * Sem as variáveis, cai automaticamente no fallback in-memory
 * (só para dev local — não funciona com múltiplas instâncias em prod).
 */

// ─── Tipos ─────────────────────────────────────────────────────────────────

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // timestamp Unix em ms
}

// ─── Fallback in-memory ─────────────────────────────────────────────────────

interface MemoryEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, MemoryEntry>();

// Limpeza periódica das entradas expiradas
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
      if (entry.resetAt < now) memoryStore.delete(key);
    }
  }, 5 * 60 * 1000);
}

function checkInMemory(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

// ─── Upstash Redis ──────────────────────────────────────────────────────────

type UpstashLimiter = {
  limit: (key: string) => Promise<{ success: boolean; remaining: number; reset: number }>;
};

let redisLimiter: UpstashLimiter | null = null;
let redisInitAttempted = false;

async function getRedisLimiter(limit: number, windowMs: number): Promise<UpstashLimiter | null> {
  if (redisInitAttempted) return redisLimiter;
  redisInitAttempted = true;

  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[rate-limit] ATENÇÃO: UPSTASH_REDIS_REST_URL / TOKEN não definidas. " +
        "Usando fallback in-memory — não funciona com múltiplas instâncias em produção."
      );
    }
    return null;
  }

  try {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis }     = await import("@upstash/redis");

    const redis = new Redis({ url, token });

    redisLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${Math.round(windowMs / 1000)} s`),
      analytics: false,
      prefix: "gdf_rl",
    });

    return redisLimiter;
  } catch (err) {
    console.error("[rate-limit] Falha ao inicializar Upstash Redis:", err);
    return null;
  }
}

// ─── API pública ────────────────────────────────────────────────────────────

/**
 * Verifica rate limit para uma chave.
 * Usa Redis em produção (quando as env vars existem), in-memory em dev.
 */
export async function checkRateLimit(
  key: string,
  limit = 20,
  windowMs = 60_000
): Promise<RateLimitResult> {
  const limiter = await getRedisLimiter(limit, windowMs);

  if (limiter) {
    try {
      const result = await limiter.limit(key);
      return {
        allowed: result.success,
        remaining: result.remaining,
        resetAt: result.reset,
      };
    } catch (err) {
      console.error("[rate-limit] Redis error, usando fallback:", err);
      // Fail open — não bloqueia o usuário se o Redis cair
      return { allowed: true, remaining: limit, resetAt: Date.now() + windowMs };
    }
  }

  return checkInMemory(key, limit, windowMs);
}

/**
 * Helper para Route Handlers do Next.js.
 * Retorna Response 429 se o limite foi atingido, null se pode prosseguir.
 *
 * @example
 * const blocked = await applyRateLimit(req, 10, 60_000);
 * if (blocked) return blocked;
 */
export async function applyRateLimit(
  req: Request,
  limit = 20,
  windowMs = 60_000
): Promise<Response | null> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "anonymous";

  const { allowed, remaining, resetAt } = await checkRateLimit(ip, limit, windowMs);

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

/**
 * Retrocompatibilidade síncrona — mantida para não quebrar chamadas existentes.
 * Substitua gradualmente por applyRateLimit (async) nas rotas.
 */
export function checkRateLimitInMemory(
  key: string,
  limit = 20,
  windowMs = 60_000
): RateLimitResult {
  return checkInMemory(key, limit, windowMs);
}
