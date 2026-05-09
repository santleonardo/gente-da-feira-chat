import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET — Listar comentários de um post (com respostas e reações)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: postId } = await params;
  try {
    const supabase = await createClient();

    const { data: comments, error } = await supabase
      .from("comments")
      .select(`
        id,
        content,
        created_at,
        author_id,
        parent_id,
        author:profiles(id, display_name, username, avatar, neighborhood),
        reactions:user_id, type
      `)
      .eq("post_id", postId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true });

    if (error) throw error;

    // Buscar reações dos comentários separadamente
    const commentIds = (comments || []).map((c: any) => c.id);
    let commentReactions: any[] = [];

    if (commentIds.length > 0) {
      const { data: reactions } = await supabase
        .from("reactions")
        .select("id, comment_id, user_id, type")
        .in("comment_id", commentIds);

      commentReactions = reactions || [];
    }

    // Montar resultado com reações
    const result = (comments || []).map((c: any) => {
      const cReactions = commentReactions
        .filter((r: any) => r.comment_id === c.id)
        .map((r: any) => ({ user_id: r.user_id, type: r.type }));
      return { ...c, reactions: cReactions };
    });

    return NextResponse.json({ comments: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Criar comentário ou resposta em um post
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: postId } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { content, parentId } = await req.json();
    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Comentário não pode estar vazio" }, { status: 400 });
    }
    if (content.trim().length > 300) {
      return NextResponse.json({ error: "Comentário muito longo (máx 300 chars)" }, { status: 400 });
    }

    const { data: post } = await supabase
      .from("posts")
      .select("id")
      .eq("id", postId)
      .eq("is_deleted", false)
      .single();

    if (!post) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });

    let effectiveParentId = null;
    if (parentId) {
      const { data: parentComment } = await supabase
        .from("comments")
        .select("id, parent_id")
        .eq("id", parentId)
        .eq("post_id", postId)
        .eq("is_deleted", false)
        .single();

      if (!parentComment) {
        return NextResponse.json({ error: "Comentário pai não encontrado" }, { status: 404 });
      }
      effectiveParentId = parentComment.parent_id || parentId;
    }

    const { data: comment, error } = await supabase
      .from("comments")
      .insert({
        content: content.trim(),
        post_id: postId,
        author_id: user.id,
        parent_id: effectiveParentId,
      })
      .select(`
        id,
        content,
        created_at,
        author_id,
        parent_id,
        author:profiles(id, display_name, username, avatar, neighborhood)
      `)
      .single();

    if (error) throw error;

    await supabase.rpc("increment_comment_count", { post_id: postId });

    return NextResponse.json({ comment: { ...comment, reactions: [] } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — Excluir comentário
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: postId } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get("commentId");
    if (!commentId) return NextResponse.json({ error: "ID do comentário necessário" }, { status: 400 });

    const { error } = await supabase
      .from("comments")
      .update({ is_deleted: true })
      .eq("id", commentId)
      .eq("author_id", user.id);

    if (error) throw error;

    await supabase.rpc("decrement_comment_count", { post_id: postId });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
