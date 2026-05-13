// ============================================================
// API de upload de fotos e vídeos para o Supabase Storage
// Bucket: post-photos (público) — images
// Suporta: images (max 500KB) e video thumbnails (max 500KB)
// Para vídeos, use /api/upload/video
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE = 500 * 1024; // 500KB
const MAX_VIDEO_THUMB_SIZE = 500 * 1024; // 500KB for thumbnails

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "posts";

    if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

    const allowedTypes = [...ALLOWED_IMAGE_TYPES];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Tipo não suportado" }, { status: 400 });
    }

    const maxSize = folder === "video-thumbs" ? MAX_VIDEO_THUMB_SIZE : MAX_IMAGE_SIZE;
    if (file.size > maxSize) {
      return NextResponse.json({
        error: "Arquivo muito grande. Comprima antes de enviar."
      }, { status: 400 });
    }

    const admin = createAdminClient();

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const path = `${user.id}/${folder}/${timestamp}-${random}.webp`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await admin.storage
      .from("post-photos")
      .upload(path, arrayBuffer, {
        contentType: "image/webp",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = admin.storage.from("post-photos").getPublicUrl(path);

    return NextResponse.json({
      url: urlData.publicUrl,
      path,
    });
  } catch (error: any) {
    console.error("Upload error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path");

    if (!path) return NextResponse.json({ error: "Caminho necessário" }, { status: 400 });

    if (!path.startsWith(user.id + "/")) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const admin = createAdminClient();
    const { error } = await admin.storage.from("post-photos").remove([path]);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
