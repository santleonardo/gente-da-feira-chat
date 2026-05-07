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
      query = query.or(`display_name.ilike.%${q}%,username.ilike.%${q}%`);
      if (userId) query = query.neq("id", userId);
    }

    const { data: users, error } = await query;
    if (error) throw error;
    return NextResponse.json({ users: users || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
