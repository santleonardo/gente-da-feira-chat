import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod/v4";

const createPostSchema = z.object({
  content: z
    .string()
    .min(1, "Conteúdo obrigatório")
    .max(500, "Máximo 500 caracteres"),
  neighborhood: z.string().nullable().optional(),
});

const reactionSchema = z.object({
  postId: z.string().min(1, "ID do post obrigatório"),
  type: z.enum(["like", "love", "haha", "wow", "sad", "angry"]).default("like"),
});

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const neighborhood = searchParams.get("neighborhood");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const authorId = searchParams.get("authorId");

    let query = supabase
      .from("posts")
      .select(
        `
        *,
        author:profiles(id, display_name, username, avatar, neighborhood),
        reactions(user_id, type)
      `
      )
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (authorId) query = query.eq("author_id", authorId);
    if (neighborhood && neighborhood !== "all") {
      query = query.or(
        `neighborhood.eq.${neighborhood},neighborhood.is.null`
      );
    }

    const { data: posts, error } = await query;
    if (error) throw error;

    return NextResponse.json({ posts: posts || [] });
  } catch (error) {
    console.error("[GET /api/posts]", error);
    return NextResponse.json(
      { error: "Erro ao buscar posts" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const { content, neighborhood } = createPostSchema.parse(body);

    const { data: post, error } = await supabase
      .from("posts")
      .insert({
        content,
        neighborhood: neighborhood || null,
        author_id: user.id,
      })
      .select(
        `
        *,
        author:profiles(id, display_name, username, avatar, neighborhood),
        reactions(user_id, type)
      `
      )
      .single();

    if (error) throw error;
    return NextResponse.json({ post });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    console.error("[POST /api/posts]", error);
    return NextResponse.json(
      { error: "Erro ao criar post" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const postId = searchParams.get("id");
    if (!postId) {
      return NextResponse.json(
        { error: "ID do post obrigatório" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("posts")
      .update({ is_deleted: true })
      .eq("id", postId)
      .eq("author_id", user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/posts]", error);
    return NextResponse.json(
      { error: "Erro ao excluir post" },
      { status: 500 }
    );
  }
}

// Re-export para o reaction endpoint poder usar os schemas
export { reactionSchema };
