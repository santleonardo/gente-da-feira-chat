// ─── Web Push helper (VAPID) ──────────────────────────────────────────────────
// Usado internamente pelas rotas de API para disparar push notifications.
// Requer as variáveis de ambiente:
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY   — chave pública VAPID
//   VAPID_PRIVATE_KEY              — chave privada VAPID
//   VAPID_MAILTO                   — e-mail do responsável (ex: mailto:admin@seuapp.com)
//
// Para gerar o par de chaves rode:
//   npx web-push generate-vapid-keys

import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/server";

// Inicializa as chaves VAPID uma única vez por processo
const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const privateKey = process.env.VAPID_PRIVATE_KEY!;
const mailto     = process.env.VAPID_MAILTO ?? "mailto:admin@gentedafeira.app";

if (publicKey && privateKey) {
  webpush.setVapidDetails(mailto, publicKey, privateKey);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

// Envia push para todas as subscriptions ativas de um usuário.
// Subscriptions inválidas (410 Gone) são removidas automaticamente.
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<void> {
  if (!publicKey || !privateKey) {
    console.warn("[push] VAPID keys não configuradas — push ignorado");
    return;
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("user_id", userId);

  if (error || !rows || rows.length === 0) return;

  const message = JSON.stringify(payload);
  const staleIds: string[] = [];

  await Promise.allSettled(
    rows.map(async (row) => {
      try {
        const sub = JSON.parse(row.subscription) as webpush.PushSubscription;
        await webpush.sendNotification(sub, message);
      } catch (err: any) {
        // 410 = subscription expirada/cancelada pelo browser
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          staleIds.push(row.id);
        } else {
          console.error("[push] Falha ao enviar:", err?.message ?? err);
        }
      }
    })
  );

  // Remove subscriptions inválidas
  if (staleIds.length > 0) {
    await admin
      .from("push_subscriptions")
      .delete()
      .in("id", staleIds);
  }
}
