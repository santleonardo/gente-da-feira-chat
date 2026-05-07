import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
        author:profiles(id, display_name, username, avatar, neighborhood),
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

    return NextResponse.json({ posts: posts || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { content, neighborhood } = await req.json();

    const { data: post, error } = await supabase
      .from("posts")
      .insert({
        content,
        neighborhood: neighborhood || null,
        author_id: user.id,
      })
      .select(`
        *,
        author:profiles(id, display_name, username, avatar, neighborhood),
        reactions(user_id, type)
      `)
      .single();

    if (error) throw error;
    return NextResponse.json({ post });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const postId = searchParams.get("id");
    if (!postId) return NextResponse.json({ error: "ID necessário" }, { status: 400 });

    const { error } = await supabase
      .from("posts")
      .update({ is_deleted: true })
      .eq("id", postId)
      .eq("author_id", user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
