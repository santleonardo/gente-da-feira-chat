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

    // Buscar configurações de privacidade do perfil
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("is_private, hide_following, hide_followers")
      .eq("id", userId)
      .single();

    const isPrivate = targetProfile?.is_private || false;
    const hideFollowing = targetProfile?.hide_following || false;
    const hideFollowers = targetProfile?.hide_followers || false;

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

    // Verificar se o usuário logado segue cada pessoa na lista de seguidores
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const isOwnProfile = authUser?.id === userId;
    let isFollowing = false;

    if (authUser && !isOwnProfile) {
      const { data: followRow } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", authUser.id)
        .eq("following_id", userId)
        .maybeSingle();
      isFollowing = !!followRow;
    }

    let followingIdsSet: Set<string> | null = null;

    if (authUser && !isOwnProfile) {
      const otherUserIds = followers?.map((f: any) => f.follower_id).filter(Boolean) || [];
      if (otherUserIds.length > 0) {
        const { data: myFollows } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", authUser.id)
          .in("following_id", otherUserIds);
        followingIdsSet = new Set((myFollows || []).map((f: any) => f.following_id));
      }
    }

    // Contagem
    const followingCount = following?.length || 0;
    const followersCount = followers?.length || 0;

    // Determinar se o viewer pode ver as listas
    const canSeeFollowing = isOwnProfile || isFollowing || !hideFollowing;
    const canSeeFollowers = isOwnProfile || isFollowing || !hideFollowers;
    const isRestricted = isPrivate && !isOwnProfile && !isFollowing;

    // Filtrar listas de acordo com privacidade
    const filteredFollowing = canSeeFollowing ? (following || []) : [];
    const filteredFollowers = canSeeFollowers ? (followers || []) : [];

    return NextResponse.json({
      followingCount,
      followersCount,
      isFollowing,
      following: filteredFollowing,
      followers: filteredFollowers,
      _privacy: {
        hide_following: hideFollowing,
        hide_followers: hideFollowers,
        canSeeFollowing,
        canSeeFollowers,
        isRestricted,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/follows — Seguir ou deixar de seguir um usuário (toggle)
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
