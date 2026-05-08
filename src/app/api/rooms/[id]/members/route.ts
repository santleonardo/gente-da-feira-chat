import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    // Buscar membros com join de perfil
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

    if (error) {
      console.error("Erro ao buscar membros (com join):", error);
      // Fallback: buscar sem join e depois buscar profiles separadamente
      const { data: rawMembers, error: err2 } = await supabase
        .from("room_members")
        .select("id, user_id, created_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });

      if (err2) throw err2;

      if (rawMembers && rawMembers.length > 0) {
        const userIds = rawMembers.map((m: any) => m.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar, neighborhood")
          .in("id", userIds);

        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

        const enriched = rawMembers.map((m: any) => ({
          id: m.id,
          user_id: m.user_id,
          joined_at: m.created_at,
          profile: profileMap.get(m.user_id) || null,
        }));

        return NextResponse.json({ members: enriched });
      }

      return NextResponse.json({ members: [] });
    }

    // Verificar se algum profile veio null (FK pode não existir)
    const hasNullProfiles = (members || []).some((m: any) => !m.profile);

    if (hasNullProfiles && members && members.length > 0) {
      const nullUserIds = members
        .filter((m: any) => !m.profile)
        .map((m: any) => m.user_id);

      if (nullUserIds.length > 0) {
        const { data: missingProfiles } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar, neighborhood")
          .in("id", nullUserIds);

        const profileMap = new Map((missingProfiles || []).map((p: any) => [p.id, p]));

        const enriched = members.map((m: any) => ({
          ...m,
          profile: m.profile || profileMap.get(m.user_id) || null,
        }));

        return NextResponse.json({ members: enriched });
      }
    }

    return NextResponse.json({ members: members || [] });
  } catch (error: any) {
    console.error("Erro geral ao buscar membros:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
