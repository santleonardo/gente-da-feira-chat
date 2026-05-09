import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/follows?userId=xxx — Buscar seguidores e seguindo de um usuário
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId é obrigatório" }, { status: 400 });
    }

    // Buscar quem o usuário segue
    const { data: following, error: fErr } = await supabase
      .from("follows")
      .select("following_id, created_at, following:profiles!follows_following_id_fkey(id, display_name, username, avatar_url, neighborhood, bio)")
      .eq("follower_id", userId)
      .order("created_at", { ascending: false });

    if (fErr) throw fErr;

    // Buscar quem segue o usuário
    const { data: followers, error: foErr } = await supabase
      .from("follows")
      .select("follower_id, created_at, follower:profiles!follows_follower_id_fkey(id, display_name, username, avatar_url, neighborhood, bio)")
      .eq("following_id", userId)
      .order("created_at", { ascending: false });

    if (foErr) throw foErr;

    // Contagem
    const followingCount = following?.length || 0;
    const followersCount = followers?.length || 0;

    // Verificar se o usuário logado segue este perfil
    const { data: { user: authUser } } = await supabase.auth.getUser();
    let isFollowing = false;
    if (authUser && authUser.id !== userId) {
      const { data: followRow } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", authUser.id)
        .eq("following_id", userId)
        .maybeSingle();
      isFollowing = !!followRow;
    }

    return NextResponse.json({
      followingCount,
      followersCount,
      isFollowing,
      following: following || [],
      followers: followers || [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/follows — Seguir ou deixar de seguir (toggle)
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { targetUserId } = await req.json();
    if (!targetUserId) {
      return NextResponse.json({ error: "targetUserId é obrigatório" }, { status: 400 });
    }

    if (user.id === targetUserId) {
      return NextResponse.json({ error: "Não pode seguir a si mesmo" }, { status: 400 });
    }

    // Verificar se já segue
    const { data: existing } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId)
      .maybeSingle();

    if (existing) {
      // Deixar de seguir
      const { error: delErr } = await supabase
        .from("follows")
        .delete()
        .eq("id", existing.id);
      if (delErr) throw delErr;
      return NextResponse.json({ following: false });
    } else {
      // Seguir
      const { error: insertErr } = await supabase
        .from("follows")
        .insert({ follower_id: user.id, following_id: targetUserId });
      if (insertErr) throw insertErr;
      return NextResponse.json({ following: true });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
