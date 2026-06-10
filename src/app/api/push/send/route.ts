// POST /api/push/send
// Rota interna — dispara Web Push para o dono de uma notificação recém-criada.
// Chamada pelas rotas de reação, comentário, follow após inserir na tabela notifications.
//
// Body: { notificationId: string }
//
// Segurança: só aceita chamadas do próprio servidor (header Authorization com
// INTERNAL_API_SECRET). Configure essa variável de ambiente no Vercel.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendPushToUser, PushPayload } from "@/lib/push";

// Mapa de tipo de notificação → texto legível
function buildPayload(
  type: string,
  actorName: string,
  postId: string | null
): PushPayload {
  const url = postId ? `/?post=${postId}` : "/";

  const messages: Record<string, { title: string; body: string; tag: string }> = {
    reaction:        { title: "Nova reação",          body: `${actorName} reagiu ao seu post`,          tag: "reaction"        },
    comment:         { title: "Novo comentário",       body: `${actorName} comentou no seu post`,        tag: "comment"         },
    reply:           { title: "Nova resposta",         body: `${actorName} respondeu seu comentário`,    tag: "reply"           },
    follow_request:  { title: "Pedido de seguir",      body: `${actorName} quer te seguir`,              tag: "follow_request"  },
    follow_accepted: { title: "Seguindo você",         body: `${actorName} aceitou seu pedido`,          tag: "follow_accepted" },
    follow:          { title: "Novo seguidor",         body: `${actorName} começou a te seguir`,         tag: "follow"          },
    mention:         { title: "Você foi mencionado",   body: `${actorName} te mencionou em um post`,     tag: "mention"         },
  };

  const msg = messages[type] ?? {
    title: "Gente da Feira",
    body: `${actorName} interagiu com você`,
    tag: "general",
  };

  return { ...msg, url };
}

export async function POST(req: NextRequest) {
  // Valida secret interno
  const secret = process.env.INTERNAL_API_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  try {
    const { notificationId } = await req.json();
    if (!notificationId) {
      return NextResponse.json({ error: "notificationId obrigatório" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Busca a notificação com actor e dono
    const { data: notif, error } = await admin
      .from("notifications")
      .select(`
        id, type, user_id, post_id,
        actor:profiles!notifications_actor_id_fkey(display_name)
      `)
      .eq("id", notificationId)
      .single();

    if (error || !notif) {
      return NextResponse.json({ error: "Notificação não encontrada" }, { status: 404 });
    }

    const actorName = (notif.actor as any)?.display_name ?? "Alguém";
    const payload   = buildPayload(notif.type, actorName, notif.post_id);

    await sendPushToUser(notif.user_id, payload);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[push/send]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
