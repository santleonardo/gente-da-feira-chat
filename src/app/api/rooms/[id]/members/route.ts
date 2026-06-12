import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// GET /api/rooms/[id]/members
// Retorna membros ativos (não banidos) com seus papéis.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: roomId } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const fetchAndEnrich = async (client: any) => {
      const { data: rawMembers, error } = await client
        .from("room_members")
        .select("id, user_id, role, created_at")
        .eq("room_id", roomId)
        .eq("is_banned", false)
        .order("role", { ascending: true })
        .order("created_at", { ascending: true });

      if (error || !rawMembers?.length) return null;

      const userIds = rawMembers.map((m: any) => m.user_id);
      const { data: profiles } = await client
        .from("profiles")
        .select("id, display_name, username, avatar_url, neighborhood")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      const roleOrder: Record<string, number> = { creator: 0, moderator: 1, member: 2 };
      return rawMembers
        .map((m: any) => ({
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          joined_at: m.created_at,
          profile: profileMap.get(m.user_id) || null,
        }))
        .sort((a: any, b: any) => (roleOrder[a.role] ?? 2) - (roleOrder[b.role] ?? 2));
    };

    try {
      const admin = createAdminClient();
      const result = await fetchAndEnrich(admin);
      if (result !== null) return NextResponse.json({ members: result });
    } catch { /* fallback */ }

    const result = await fetchAndEnrich(supabase);
    return NextResponse.json({ members: result || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
