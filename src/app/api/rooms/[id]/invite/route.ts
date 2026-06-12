import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/rooms/[id]/invite
// Body: { user_id }
// Qualquer membro pode convidar, respeitando capacidade e status da sala.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: roomId } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { user_id: targetId } = await req.json();
    if (!targetId) return NextResponse.json({ error: "user_id obrigatório" }, { status: 400 });
    if (targetId === user.id) return NextResponse.json({ error: "Você não pode convidar a si mesmo" }, { status: 400 });

    // Verifica se solicitante é membro
    const { data: actorMember } = await supabase
      .from("room_members")
      .select("role, is_banned")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!actorMember || actorMember.is_banned) {
      return NextResponse.json({ error: "Você precisa ser membro para convidar" }, { status: 403 });
    }

    // Busca sala
    const { data: room } = await supabase
      .from("rooms")
      .select("id, is_active, is_open, max_members, member_count")
      .eq("id", roomId)
      .single();

    if (!room) return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
    if (!room.is_active) return NextResponse.json({ error: "Sala inativa" }, { status: 403 });

    // Sala fechada: só creator/moderator pode convidar
    if (!room.is_open && !["creator", "moderator"].includes(actorMember.role)) {
      return NextResponse.json({ error: "Sala fechada — apenas moderadores podem convidar" }, { status: 403 });
    }

    // Verifica capacidade
    if (room.member_count >= room.max_members) {
      return NextResponse.json({ error: `Sala lotada (máx ${room.max_members} membros).` }, { status: 403 });
    }

    // Verifica se alvo já é membro ou banido
    const { data: existingTarget } = await supabase
      .from("room_members")
      .select("id, is_banned, banned_until, role")
      .eq("room_id", roomId)
      .eq("user_id", targetId)
      .maybeSingle();

    if (existingTarget) {
      if (existingTarget.is_banned) {
        return NextResponse.json({ error: "Este usuário está banido da sala" }, { status: 403 });
      }
      return NextResponse.json({ error: "Usuário já é membro desta sala" }, { status: 400 });
    }

    // Adiciona como membro
    const { error } = await supabase.from("room_members").insert({
      room_id: roomId,
      user_id: targetId,
      role: "member",
    });

    if (error) throw error;
    return NextResponse.json({ invited: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
