import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: rooms, error } = await supabase
      .from("rooms")
      .select(`
        *,
        room_members(count)
      `)
      .eq("is_active", true)
      .order("type", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;

    // Format to match expected frontend shape
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
