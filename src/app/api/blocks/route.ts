import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId");

    if (!targetUserId) {
      const { data: blocks, error } = await supabase
        .from("blocks")
        .select("id, blocked_id, created_at, blocked:profiles!blocks_blocked_id_fkey(id, display_name, username, avatar_url)")
        .eq("blocker_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return NextResponse.json({ blocks: blocks || [] });
    }

    const { data: blockRow } = await supabase
      .from("blocks")
      .select("id")
      .eq("blocker_id", user.id)
      .eq("blocked_id", targetUserId)
      .maybeSingle();

    return NextResponse.json({ isBlocked: !!blockRow });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { targetUserId } = await req.json();
    if (!targetUserId) return NextResponse.json({ error: "targetUserId é obrigatório" }, { status: 400 });
    if (user.id === targetUserId) return NextResponse.json({ error: "Não pode bloquear a si mesmo" }, { status: 400 });

    const { data: existingBlock } = await supabase
      .from("blocks")
      .select("id")
      .eq("blocker_id", user.id)
      .eq("blocked_id", targetUserId)
      .maybeSingle();

    if (existingBlock) {
      const { error: delErr } = await supabase.from("blocks").delete().eq("id", existingBlock.id);
      if (delErr) throw delErr;
      return NextResponse.json({ blocked: false });
    } else {
      const { error: insertErr } = await supabase
        .from("blocks")
        .insert({ blocker_id: user.id, blocked_id: targetUserId });

      if (insertErr) throw insertErr;

      // Remove follow relationships both ways
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetUserId);
      await supabase.from("follows").delete().eq("follower_id", targetUserId).eq("following_id", user.id);

      return NextResponse.json({ blocked: true });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
