import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    try {
      const admin = createAdminClient();
      const { data: adminMembers, error: adminErr } = await admin.from("room_members").select("id, user_id, created_at").eq("room_id", roomId).order("created_at", { ascending: true });

      if (!adminErr && adminMembers && adminMembers.length > 0) {
        const userIds = adminMembers.map((m: any) => m.user_id);
        const { data: profiles } = await admin.from("profiles").select("id, display_name, username, avatar_url, neighborhood").in("id", userIds);
        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
        const enriched = adminMembers.map((m: any) => ({ id: m.id, user_id: m.user_id, joined_at: m.created_at, profile: profileMap.get(m.user_id) || null }));
        return NextResponse.json({ members: enriched });
      }

      if (adminErr) {
        console.error("Admin client error:", adminErr.message);
      } else {
        const { data: room } = await admin.from("rooms").select("id").eq("id", roomId).single();
        if (room) return NextResponse.json({ members: [] });
      }
    } catch (adminErr: any) {
      console.error("Admin client not available:", adminErr.message);
    }

    const { data: members, error } = await supabase.from("room_members").select("id, user_id, created_at").eq("room_id", roomId).order("created_at", { ascending: true });

    if (!error && members && members.length > 0) {
      const userIds = members.map((m: any) => m.user_id);
      const { data: profiles } = await supabase.from("profiles").select("id, display_name, username, avatar_url, neighborhood").in("id", userIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      const enriched = members.map((m: any) => ({ id: m.id, user_id: m.user_id, joined_at: m.created_at, profile: profileMap.get(m.user_id) || null }));
      return NextResponse.json({ members: enriched });
    }

    if (error) console.error("Normal client error:", error.message);
    return NextResponse.json({ members: [] });
  } catch (error: any) {
    console.error("Members API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
