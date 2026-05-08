import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: rooms, error } = await supabase
      .from("rooms")
      .select(
        `
        *,
        room_members(count)
      `
      )
      .eq("is_active", true)
      .order("type", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;

    const formatted = (rooms || []).map((r: Record<string, unknown>) => ({
      ...r,
      _count: {
        members: (r.room_members as { count: number }[] | null)?.[0]?.count || 0,
        messages: 0,
      },
      room_members: undefined,
    }));

    return NextResponse.json({ rooms: formatted });
  } catch (error) {
    console.error("[GET /api/rooms]", error);
    return NextResponse.json(
      { error: "Erro ao buscar salas" },
      { status: 500 }
    );
  }
}
