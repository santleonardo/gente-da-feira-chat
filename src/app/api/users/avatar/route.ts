import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const userId = formData.get("userId") as string | null;

    if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
    if (!userId || userId !== user.id) return NextResponse.json({ error: "ID do usuário inválido" }, { status: 400 });
    if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: "Arquivo muito grande (máx 2MB)" }, { status: 400 });

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) return NextResponse.json({ error: "Tipo de arquivo não suportado (use JPG, PNG, WebP ou GIF)" }, { status: 400 });

    const admin = createAdminClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/avatar.${ext}`;

    await admin.storage.from("avatars").remove([path]);

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await admin.storage.from("avatars").upload(path, arrayBuffer, { contentType: file.type, upsert: true });
    if (uploadError) throw uploadError;

    const { data: urlData } = admin.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await admin.from("profiles").update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() }).eq("id", userId);
    if (updateError) throw updateError;

    return NextResponse.json({ avatar_url: avatarUrl });
  } catch (error: any) {
    console.error("Avatar upload error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
