import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/rooms/[id]/promote
// Body: { user_id, role: 'moderator' | 'member' }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: roomId } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { user_id: targetId, role: newRole } = await req.json();
    if (!targetId) return NextResponse.json({ error: "user_id obrigatório" }, { status: 400 });
    if (!["moderator", "member"].includes(newRole)) {
      return NextResponse.json({ error: "role deve ser 'moderator' ou 'member'" }, { status: 400 });
    }
    if (targetId === user.id) return NextResponse.json({ error: "Ação inválida sobre si mesmo" }, { status: 400 });

    const { data: actorMember } = await supabase
      .from("room_members")
      .select("role")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .single();

    if (!actorMember || actorMember.role !== "creator") {
      return NextResponse.json({ error: "Apenas o criador pode promover/rebaixar moderadores" }, { status: 403 });
    }

    const { data: targetMember } = await supabase
      .from("room_members")
      .select("role")
      .eq("room_id", roomId)
      .eq("user_id", targetId)
      .single();

    if (!targetMember) return NextResponse.json({ error: "Usuário não é membro desta sala" }, { status: 404 });
    if (targetMember.role === "creator") return NextResponse.json({ error: "Não é possível alterar o papel do criador" }, { status: 403 });

    const { error } = await supabase
      .from("room_members")
      .update({ role: newRole })
      .eq("room_id", roomId)
      .eq("user_id", targetId);

    if (error) throw error;
    return NextResponse.json({ promoted: true, role: newRole });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
