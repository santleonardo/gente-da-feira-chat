import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const usernames = searchParams.get("usernames");

    if (!usernames) {
      return NextResponse.json({ users: {} });
    }

    const usernameList = usernames
      .split(",")
      .map((u) => u.trim().replace("@", "").replace(/[^\w.-]/g, ""))
      .filter(Boolean)
      .slice(0, 20); // limit

    if (usernameList.length === 0) {
      return NextResponse.json({ users: {} });
    }

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, username, avatar")
      .in("username", usernameList);

    if (error) throw error;

    // Return as { username: { id, avatar } } map
    const usersMap: Record<string, { id: string; avatar: string | null }> = {};
    for (const p of profiles || []) {
      usersMap[p.username] = { id: p.id, avatar: p.avatar };
    }

    return NextResponse.json({ users: usersMap });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
