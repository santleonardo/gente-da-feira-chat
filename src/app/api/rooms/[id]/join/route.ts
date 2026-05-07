import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { userId, roomId } = await req.json();
    if (userId !== user.id) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

    // Verificar se já é membro
    const { data: existing } = await supabase
      .from("room_members")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) return NextResponse.json({ joined: true });

    const { error } = await supabase.from("room_members").insert({
      room_id: roomId,
      user_id: userId,
    });

    if (error) throw error;
    return NextResponse.json({ joined: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
