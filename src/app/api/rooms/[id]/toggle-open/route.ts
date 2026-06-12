import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/rooms/[id]/toggle-open
// Body: { is_open: boolean }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: roomId } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { is_open } = await req.json();
    if (typeof is_open !== "boolean") {
      return NextResponse.json({ error: "is_open deve ser boolean" }, { status: 400 });
    }

    const { data: actorMember } = await supabase
      .from("room_members")
      .select("role")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .single();

    if (!actorMember || !["creator", "moderator"].includes(actorMember.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const { error } = await supabase
      .from("rooms")
      .update({ is_open })
      .eq("id", roomId);

    if (error) throw error;
    return NextResponse.json({ is_open });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
