import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const q = searchParams.get("q");

    let query = supabase
      .from("profiles")
      .select("id, display_name, username, avatar, neighborhood, bio")
      .limit(15);

    if (q) {
      // Sanitizar input para evitar injection no filtro PostgREST
      const sanitized = q.replace(/[%_.,]/g, "\\$&");
      query = query.or(
        `display_name.ilike.%${sanitized}%,username.ilike.%${sanitized}%`
      );
      if (userId) query = query.neq("id", userId);
    }

    const { data: users, error } = await query;
    if (error) throw error;
    return NextResponse.json({ users: users || [] });
  } catch (error) {
    console.error("[GET /api/users]", error);
    return NextResponse.json(
      { error: "Erro ao buscar usuários" },
      { status: 500 }
    );
  }
}
