import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: rooms, error } = await supabase
      .from("rooms")
      .select(`*, room_members(count)`)
      .eq("is_active", true)
      .order("type", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;

    const formatted = (rooms || []).map((r: any) => ({
      ...r,
      _count: { members: r.room_members?.[0]?.count || 0, messages: 0 },
      memberCount: r.member_count,
      room_members: undefined,
    }));

    return NextResponse.json({ rooms: formatted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await req.json();
    const name = (body.name || "").trim();
    const description = (body.description || "").trim();
    const icon = body.icon || "💬";

    if (!name) return NextResponse.json({ error: "Nome da sala é obrigatório" }, { status: 400 });
    if (name.length > 50) return NextResponse.json({ error: "Nome muito longo" }, { status: 400 });

    const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);

    const { data: room, error } = await supabase
      .from("rooms")
      .insert({ name, slug, icon, description: description || null, type: "community", is_active: true, created_by: user.id })
      .select().single();

    if (error) throw error;

    await supabase.from("room_members").insert({ room_id: room.id, user_id: user.id });

    return NextResponse.json({ room: { ...room, memberCount: 1 } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
