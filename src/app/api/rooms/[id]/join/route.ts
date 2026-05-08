import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { data: room } = await supabase
      .from("rooms")
      .select("id, is_active")
      .eq("id", roomId)
      .single();

    if (!room || !room.is_active) {
      return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
    }

    const { data: existing } = await supabase
      .from("room_members")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) return NextResponse.json({ joined: true });

    const { error } = await supabase.from("room_members").insert({
      room_id: roomId,
      user_id: user.id,
    });

    if (error) throw error;
    return NextResponse.json({ joined: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
