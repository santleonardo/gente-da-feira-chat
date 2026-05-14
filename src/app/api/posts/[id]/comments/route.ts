import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: postId } = await params;
  try {
    const supabase = await createClient();
    const { data: comments, error } = await supabase
      .from("comments")
      .select(`
        id, content, created_at, author_id, parent_id,
        author:profiles(id, display_name, username, avatar_url, neighborhood)
      `)
      .eq("post_id", postId).eq("is_deleted", false)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ comments: comments || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: postId } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { content, parentId } = await req.json();
    if (!content || !content.trim()) return NextResponse.json({ error: "Comentário não pode estar vazio" }, { status: 400 });
    if (content.trim().length > 300) return NextResponse.json({ error: "Comentário muito longo (máx 300 chars)" }, { status: 400 });

    const { data: post } = await supabase.from("posts").select("id").eq("id", postId).eq("is_deleted", false).single();
    if (!post) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });

    const insertData: Record<string, any> = { content: content.trim(), post_id: postId, author_id: user.id };
    if (parentId) insertData.parent_id = parentId;

    const { data: comment, error } = await supabase
      .from("comments").insert(insertData)
      .select(`id, content, created_at, author_id, parent_id, author:profiles(id, display_name, username, avatar_url, neighborhood)`)
      .single();

    if (error) throw error;
    // Contagem de comentários é feita dinamicamente via comments(count) no GET /api/posts
    return NextResponse.json({ comment });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: postId } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get("commentId");
    if (!commentId) return NextResponse.json({ error: "ID do comentário necessário" }, { status: 400 });

    const { error } = await supabase.from("comments").update({ is_deleted: true }).eq("id", commentId).eq("author_id", user.id);
    if (error) throw error;
    // Contagem de comentários é feita dinamicamente via comments(count) no GET /api/posts
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
