import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod/v4";

const reactionSchema = z.object({
  postId: z.string().min(1, "ID do post obrigatório"),
  type: z.enum(["like", "love", "haha", "wow", "sad", "angry"]).default("like"),
});

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const { postId, type } = reactionSchema.parse(body);

    // Upsert atômico — evita race condition (TOCTOU)
    const { error: upsertError } = await supabase
      .from("reactions")
      .upsert(
        { post_id: postId, user_id: user.id, type },
        { onConflict: "post_id,user_id" }
      );

    if (!upsertError) {
      return NextResponse.json({ reacted: true });
    }

    // Se conflito (já existe), faz toggle off (remove)
    if (upsertError && (upsertError as any).code === "23505") {
      const { error: deleteError } = await supabase
        .from("reactions")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id);
      if (deleteError) throw deleteError;
      return NextResponse.json({ reacted: false });
    }

    throw upsertError;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    console.error("[POST /api/posts/reaction]", error);
    return NextResponse.json(
      { error: "Erro ao reagir" },
      { status: 500 }
    );
  }
}
