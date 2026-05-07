import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { postId, type = "like" } = await req.json();

    // Verificar se já reagiu
    const { data: existing } = await supabase
      .from("reactions")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      await supabase.from("reactions").delete().eq("id", existing.id);
      return NextResponse.json({ reacted: false });
    } else {
      await supabase.from("reactions").insert({
        post_id: postId,
        user_id: user.id,
        type,
      });
      return NextResponse.json({ reacted: true });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
