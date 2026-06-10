// Helper para disparar push de forma fire-and-forget a partir de rotas de API.
// Chama /api/push/send internamente usando a URL base do servidor.

export async function dispatchPushForNotification(notificationId: string): Promise<void> {
  try {
    const base   = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    const secret = process.env.INTERNAL_API_SECRET;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (secret) headers["Authorization"] = `Bearer ${secret}`;

    await fetch(`${base}/api/push/send`, {
      method: "POST",
      headers,
      body: JSON.stringify({ notificationId }),
    });
  } catch {
    // Silencioso — push é best-effort
  }
}
