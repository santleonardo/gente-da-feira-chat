import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const username = searchParams.get("username");

    // Exact username lookup (used for @mention resolution)
    if (username) {
      const sanitized = username.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30);
      if (!sanitized) {
        return NextResponse.json({ error: "Username inválido" }, { status: 400 });
      }
      const { data: user, error } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, neighborhood, bio")
        .eq("username", sanitized)
        .maybeSingle();
      if (error) throw error;
      if (!user) {
        return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
      }
      return NextResponse.json({ user });
    }

    let query = supabase.from("profiles").select("id, display_name, username, avatar_url, neighborhood, bio").limit(15);

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
