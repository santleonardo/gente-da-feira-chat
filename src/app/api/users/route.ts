import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const usernames = searchParams.get("usernames");

    // ─── Resolve usernames to IDs (for @mention rendering) ───
    if (usernames) {
      const usernameList = usernames
        .split(",")
        .map((u) => u.trim().replace("@", "").replace(/[^\w.-]/g, ""))
        .filter(Boolean)
        .slice(0, 20);

      if (usernameList.length === 0) {
        return NextResponse.json({ users: {} });
      }

      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, username, avatar")
        .in("username", usernameList);

      if (error) throw error;

      const usersMap: Record<string, { id: string; avatar: string | null }> = {};
      for (const p of profiles || []) {
        usersMap[p.username] = { id: p.id, avatar: p.avatar };
      }

      return NextResponse.json({ users: usersMap });
    }

    // ─── Search users by name/username ───
    let query = supabase.from("profiles").select("id, display_name, username, avatar, avatar_url, neighborhood, bio").limit(15);

    if (q) {
      const sanitized = q.replace(/[^\w\s@.-]/g, "").slice(0, 50);
      if (sanitized) {
        query = query.or(`display_name.ilike.%${sanitized}%,username.ilike.%${sanitized}%`);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) query = query.neq("id", user.id);
      }
    }

    const { data: users, error } = await query;
    if (error) throw error;
    return NextResponse.json({ users: users || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
