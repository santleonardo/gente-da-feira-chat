// ============================================================
// API de upload de vídeos para o Supabase Storage
// Bucket: profile-videos (público)
// Máximo: 50MB, formatos: video/mp4, video/webm
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "videos";

    if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      return NextResponse.json({
        error: "Tipo não suportado. Use MP4 ou WebM."
      }, { status: 400 });
    }

    if (file.size > MAX_VIDEO_SIZE) {
      return NextResponse.json({
        error: `Vídeo muito grande. Máximo ${MAX_VIDEO_SIZE / (1024 * 1024)}MB.`
      }, { status: 400 });
    }

    const admin = createAdminClient();

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = file.type === "video/mp4" ? "mp4" : "webm";
    const path = `${user.id}/${folder}/${timestamp}-${random}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await admin.storage
      .from("profile-videos")
      .upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = admin.storage.from("profile-videos").getPublicUrl(path);

    return NextResponse.json({
      url: urlData.publicUrl,
      path,
    });
  } catch (error: any) {
    console.error("Video upload error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
