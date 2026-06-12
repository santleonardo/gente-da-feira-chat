import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/rooms/[id]/ban
// Body: { user_id, duration_days? }
// duration_days: número de dias, ou null/omitido = banimento permanente
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: roomId } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { user_id: targetId, duration_days } = await req.json();
    if (!targetId) return NextResponse.json({ error: "user_id obrigatório" }, { status: 400 });
    if (targetId === user.id) return NextResponse.json({ error: "Você não pode banir a si mesmo" }, { status: 400 });

    // Papel do solicitante
    const { data: actorMember } = await supabase
      .from("room_members")
      .select("role")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .single();

    if (!actorMember || !["creator", "moderator"].includes(actorMember.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    // Papel do alvo
    const { data: targetMember } = await supabase
      .from("room_members")
      .select("id, role")
      .eq("room_id", roomId)
      .eq("user_id", targetId)
      .maybeSingle();

    if (targetMember?.role === "creator") {
      return NextResponse.json({ error: "Não é possível banir o criador da sala" }, { status: 403 });
    }
    if (actorMember.role === "moderator" && targetMember?.role === "moderator") {
      return NextResponse.json({ error: "Moderadores não podem banir outros moderadores" }, { status: 403 });
    }

    // Calcula expiração
    let bannedUntil: string | null = null;
    if (duration_days && Number.isFinite(Number(duration_days)) && Number(duration_days) > 0) {
      const expires = new Date();
      expires.setDate(expires.getDate() + Number(duration_days));
      bannedUntil = expires.toISOString();
    }

    if (targetMember) {
      // Já é membro: marca como banido (mantém linha para histórico)
      await supabase
        .from("room_members")
        .update({ is_banned: true, banned_until: bannedUntil })
        .eq("room_id", roomId)
        .eq("user_id", targetId);
    } else {
      // Nunca foi membro: insere linha de ban para bloquear entrada futura
      await supabase.from("room_members").insert({
        room_id: roomId,
        user_id: targetId,
        role: "member",
        is_banned: true,
        banned_until: bannedUntil,
      });
    }

    return NextResponse.json({
      banned: true,
      permanent: !bannedUntil,
      banned_until: bannedUntil,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/rooms/[id]/ban  → remover banimento
// Body: { user_id }
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: roomId } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { user_id: targetId } = await req.json();

    const { data: actorMember } = await supabase
      .from("room_members")
      .select("role")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .single();

    if (!actorMember || !["creator", "moderator"].includes(actorMember.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    await supabase
      .from("room_members")
      .update({ is_banned: false, banned_until: null })
      .eq("room_id", roomId)
      .eq("user_id", targetId);

    return NextResponse.json({ unbanned: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
