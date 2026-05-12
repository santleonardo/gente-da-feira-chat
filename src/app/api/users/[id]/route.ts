import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = await createClient();

    const { data: profile, error } = await supabase
      .from("profiles")
      .select(`
        *,
        posts(count)
      `)
      .eq("id", id)
      .single();

    if (error || !profile) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // Verificar privacidade
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const isOwnProfile = authUser?.id === id;
    let isFollowing = false;

    if (authUser && !isOwnProfile) {
      const { data: followRow } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", authUser.id)
        .eq("following_id", id)
        .maybeSingle();
      isFollowing = !!followRow;
    }

    const isPrivate = profile.is_private || false;
    const hideFollowing = profile.hide_following || false;
    const hideFollowers = profile.hide_followers || false;
    const isRestricted = isPrivate && !isOwnProfile && !isFollowing;

    const formatted = {
      ...profile,
      name: profile.display_name,
      _count: { posts: profile.posts?.[0]?.count || 0 },
      posts: undefined,
    };

    const privacyResponse = {
      is_private: isPrivate,
      hide_following: hideFollowing,
      hide_followers: hideFollowers,
      isRestricted,
    };

    return NextResponse.json({ user: formatted, _privacy: privacyResponse });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const data = await req.json();
    const updates: Record<string, any> = {};

    if (data.name !== undefined) {
      const name = String(data.name).trim().slice(0, 50);
      if (!name) return NextResponse.json({ error: "Nome não pode ser vazio" }, { status: 400 });
      updates.display_name = name;
    }

    if (data.bio !== undefined) {
      updates.bio = String(data.bio).trim().slice(0, 300);
    }

    if (data.neighborhood !== undefined) {
      updates.neighborhood = data.neighborhood || null;
    }

    if (data.theme !== undefined) {
      updates.theme = String(data.theme).slice(0, 20);
    }

    if (data.username !== undefined) {
      const username = String(data.username).trim().slice(0, 30).toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (!username || username.length < 3) {
        return NextResponse.json({ error: "Username deve ter pelo menos 3 caracteres (apenas letras, números e _)" }, { status: 400 });
      }
      updates.username = username;
    }

    // Campos de privacidade
    if (data.is_private !== undefined) {
      updates.is_private = Boolean(data.is_private);
    }

    if (data.hide_following !== undefined) {
      updates.hide_following = Boolean(data.hide_following);
    }

    if (data.hide_followers !== undefined) {
      updates.hide_followers = Boolean(data.hide_followers);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data: profile, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ user: { ...profile, name: profile.display_name } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
