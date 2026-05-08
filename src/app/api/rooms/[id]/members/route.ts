import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { data: members, error } = await supabase
      .from("room_members")
      .select(`
        id,
        user_id,
        joined_at:created_at,
        profile:profiles(id, display_name, username, avatar, neighborhood)
      `)
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ members: members || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
