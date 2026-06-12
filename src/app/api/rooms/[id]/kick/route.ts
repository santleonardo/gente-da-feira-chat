import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/rooms/[id]/kick
// Body: { user_id }
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
    if (targetId === user.id) return NextResponse.json({ error: "Você não pode expulsar a si mesmo" }, { status: 400 });

    const { data: actorMember } = await supabase
      .from("room_members")
      .select("role")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .single();

    if (!actorMember || !["creator", "moderator"].includes(actorMember.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const { data: targetMember } = await supabase
      .from("room_members")
      .select("role")
      .eq("room_id", roomId)
      .eq("user_id", targetId)
      .single();

    if (!targetMember) return NextResponse.json({ error: "Usuário não é membro desta sala" }, { status: 404 });

    if (actorMember.role === "moderator" && targetMember.role !== "member") {
      return NextResponse.json({ error: "Moderadores só podem expulsar membros comuns" }, { status: 403 });
    }
    if (targetMember.role === "creator") {
      return NextResponse.json({ error: "Não é possível expulsar o criador da sala" }, { status: 403 });
    }

    const { error } = await supabase
      .from("room_members")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", targetId);

    if (error) throw error;
    return NextResponse.json({ kicked: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
