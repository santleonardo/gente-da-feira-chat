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

    // Verificar se já reagiu
    const { data: existing } = await supabase
      .from("reactions")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from("reactions").delete().eq("id", existing.id);
      if (error) throw error;
      return NextResponse.json({ reacted: false });
    } else {
      const { error } = await supabase.from("reactions").insert({
        post_id: postId,
        user_id: user.id,
        type,
      });
      if (error) throw error;
      return NextResponse.json({ reacted: true });
    }
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
