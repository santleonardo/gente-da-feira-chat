// ============================================================
// API de reações nos vídeos do perfil
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { videoId, type } = await req.json();
    if (!videoId || !type) {
      return NextResponse.json({ error: "videoId e type são obrigatórios" }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from("profile_video_reactions")
      .select("id")
      .eq("video_id", videoId)
      .eq("user_id", user.id)
      .eq("type", type)
      .maybeSingle();

    if (existing) {
      const admin = createAdminClient();
      const { error } = await admin
        .from("profile_video_reactions")
        .delete()
        .eq("id", existing.id);

      if (error) throw error;
      return NextResponse.json({ reacted: false });
    } else {
      const { error } = await supabase
        .from("profile_video_reactions")
        .insert({
          video_id: videoId,
          user_id: user.id,
          type,
        });

      if (error) throw error;
      return NextResponse.json({ reacted: true });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
