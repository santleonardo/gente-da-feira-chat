import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
    }

    // Validar tipo
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Tipo de arquivo não permitido (use JPG, PNG, WebP ou GIF)" }, { status: 400 });
    }

    // Validar tamanho (2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "Arquivo muito grande (máx 2MB)" }, { status: 400 });
    }

    // Gerar caminho: avatars/{userId}/avatar.{ext}
    const ext = file.type.split("/")[1];
    const filePath = `${user.id}/avatar.${ext}`;

    // Deletar avatar anterior
    const { data: existingFiles } = await supabase.storage
      .from("avatars")
      .list(user.id);

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map((f) => `${user.id}/${f.name}`);
      await supabase.storage.from("avatars").remove(filesToDelete);
    }

    // Upload do novo avatar
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true, contentType: file.type });

    if (uploadError) throw uploadError;

    // Pegar URL pública
    const { data: { publicUrl } } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    // Adicionar cache-bust para evitar cache do browser
    const avatarUrl = `${publicUrl}?t=${Date.now()}`;

    // Atualizar perfil
    const { data: profile, error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .select("*")
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ user: { ...profile, name: profile.display_name }, avatarUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
