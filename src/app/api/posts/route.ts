// ============================================================
// API de Posts - atualizada com suporte a fotos e expiração
// - Posts com foto: máx 5 fotos, expiram em 12h
// - Máx 5 posts com foto ativos por usuário
// - Limpeza automática de posts expirados
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const MAX_PHOTOS_PER_POST = 5;
const MAX_ACTIVE_PHOTO_POSTS = 5;
const PHOTO_POST_EXPIRATION_HOURS = 12;

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const neighborhood = searchParams.get("neighborhood");
    const limit = parseInt(searchParams.get("limit") || "20");
    const authorId = searchParams.get("authorId");

    let query = supabase
      .from("posts")
      .select(`
        *,
        author:profiles(id, display_name, username, avatar_url, neighborhood),
        reactions(user_id, type)
      `)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (authorId) query = query.eq("author_id", authorId);
    if (neighborhood && neighborhood !== "all") {
      query = query.or(`neighborhood.eq.${neighborhood},neighborhood.is.null`);
    }

    const { data: posts, error } = await query;
    if (error) throw error;

    // Filtrar posts expirados
    const now = new Date().toISOString();
    const filteredPosts = (posts || []).filter((p: any) => {
      if (p.expires_at && p.expires_at < now) return false;
      return true;
    });

    // Limpar posts expirados em background
    cleanupExpiredPosts().catch(() => {});

    return NextResponse.json({ posts: filteredPosts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function cleanupExpiredPosts() {
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { data: expiredPosts } = await admin
      .from("posts")
      .select("id, image_urls")
      .lt("expires_at", now)
      .eq("is_deleted", false);

    if (!expiredPosts || expiredPosts.length === 0) return;

    const expiredIds = expiredPosts.map((p: any) => p.id);
    await admin.from("posts").update({ is_deleted: true }).in("id", expiredIds);

    for (const post of expiredPosts) {
      if (post.image_urls && post.image_urls.length > 0) {
        const paths = extractStoragePaths(post.image_urls);
        if (paths.length > 0) {
          await admin.storage.from("post-photos").remove(paths).catch(() => {});
        }
      }
    }
  } catch { /* silent */ }
}

function extractStoragePaths(urls: string[]): string[] {
  return urls
    .map((url: string) => {
      try {
        const urlObj = new URL(url);
        const parts = urlObj.pathname.split("/");
        const bucketIndex = parts.indexOf("post-photos");
        if (bucketIndex >= 0) {
          return parts.slice(bucketIndex + 1).join("/");
        }
        return null;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as string[];
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { content, neighborhood, imageUrls } = await req.json();

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Conteúdo é obrigatório" }, { status: 400 });
    }
    if (content.trim().length > 500) {
      return NextResponse.json({ error: "Post muito longo (máx 500 chars)" }, { status: 400 });
    }

    let expiresAt: string | null = null;
    const hasPhotos = imageUrls && imageUrls.length > 0;

    if (hasPhotos) {
      if (imageUrls.length > MAX_PHOTOS_PER_POST) {
        return NextResponse.json({
          error: `Máximo ${MAX_PHOTOS_PER_POST} fotos por post`
        }, { status: 400 });
      }

      const now = new Date().toISOString();
      const { data: activePhotoPosts, error: countError } = await supabase
        .from("posts")
        .select("id")
        .eq("author_id", user.id)
        .eq("is_deleted", false)
        .gt("expires_at", now);

      if (countError) throw countError;

      if (activePhotoPosts && activePhotoPosts.length >= MAX_ACTIVE_PHOTO_POSTS) {
        const { data: nextExpiring } = await supabase
          .from("posts")
          .select("expires_at")
          .eq("author_id", user.id)
          .eq("is_deleted", false)
          .gt("expires_at", now)
          .order("expires_at", { ascending: true })
          .limit(1);

        const expiresIn = nextExpiring?.[0]?.expires_at
          ? getTimeUntil(nextExpiring[0].expires_at)
          : "em breve";

        return NextResponse.json({
          error: `Você já tem ${MAX_ACTIVE_PHOTO_POSTS} posts com fotos ativos. Próximo expira ${expiresIn}.`
        }, { status: 400 });
      }

      const expires = new Date();
      expires.setHours(expires.getHours() + PHOTO_POST_EXPIRATION_HOURS);
      expiresAt = expires.toISOString();
    }

    const insertData: any = {
      content: content.trim(),
      neighborhood: neighborhood || null,
      author_id: user.id,
      image_urls: hasPhotos ? imageUrls : [],
      expires_at: expiresAt,
    };

    const { data: post, error } = await supabase
      .from("posts")
      .insert(insertData)
      .select(`
        *,
        author:profiles(id, display_name, username, avatar_url, neighborhood),
        reactions(user_id, type)
      `)
      .single();

    if (error) throw error;
    return NextResponse.json({ post });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function getTimeUntil(expiresAt: string): string {
  const now = Date.now();
  const expires = new Date(expiresAt).getTime();
  const diff = expires - now;

  if (diff <= 0) return "agora";
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);

  if (hours > 0) return `em ${hours}h${mins > 0 ? ` ${mins}min` : ""}`;
  return `em ${mins}min`;
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const postId = searchParams.get("id");
    if (!postId) return NextResponse.json({ error: "ID necessário" }, { status: 400 });

    const admin = createAdminClient();
    const { data: post } = await admin
      .from("posts")
      .select("image_urls")
      .eq("id", postId)
      .eq("author_id", user.id)
      .single();

    const { error } = await admin
      .from("posts")
      .update({ is_deleted: true })
      .eq("id", postId)
      .eq("author_id", user.id);

    if (error) throw error;

    if (post?.image_urls && post.image_urls.length > 0) {
      const paths = extractStoragePaths(post.image_urls);
      if (paths.length > 0) {
        await admin.storage.from("post-photos").remove(paths).catch(() => {});
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
