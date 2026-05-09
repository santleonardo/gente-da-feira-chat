import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_TYPES = ["😂", "😔", "😲", "😡", "😍"];

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { commentId, type = "😂" } = await req.json();

    if (!commentId) {
      return NextResponse.json({ error: "ID do comentário necessário" }, { status: 400 });
    }

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: "Reação inválida" }, { status: 400 });
    }

    // Verificar se o comentário existe
    const { data: comment } = await supabase
      .from("comments")
      .select("id")
      .eq("id", commentId)
      .eq("is_deleted", false)
      .maybeSingle();

    if (!comment) {
      return NextResponse.json({ error: "Comentário não encontrado" }, { status: 404 });
    }

    // Toggle reação
    const { data: existing } = await supabase
      .from("reactions")
      .select("id")
      .eq("comment_id", commentId)
      .eq("user_id", user.id)
      .eq("type", type)
      .maybeSingle();

    if (existing) {
      await supabase.from("reactions").delete().eq("id", existing.id);
      return NextResponse.json({ reacted: false, type });
    } else {
      await supabase.from("reactions").insert({
        comment_id: commentId,
        user_id: user.id,
        type,
        post_id: null,
      });
      return NextResponse.json({ reacted: true, type });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
