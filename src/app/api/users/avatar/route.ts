import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

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
      return NextResponse.json({ error: "Tipo não permitido (use JPG, PNG, WebP ou GIF)" }, { status: 400 });
    }

    // Validar tamanho (2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "Arquivo muito grande (máx 2MB)" }, { status: 400 });
    }

    // Gerar caminho: avatars/{userId}/avatar.{ext}
    const ext = file.type.split("/")[1] || "png";
    const filePath = `${user.id}/avatar.${ext}`;

    // Usar admin client para garantir permissão de upload
    const adminClient = createAdminClient();

    // Deletar avatars anteriores do usuário
    try {
      const { data: existingFiles } = await adminClient.storage
        .from("avatars")
        .list(user.id);

      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map((f: any) => `${user.id}/${f.name}`);
        await adminClient.storage.from("avatars").remove(filesToDelete);
      }
    } catch {
      // Se não conseguir listar, continua mesmo assim
    }

    // Converter File para ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload do novo avatar
    const { error: uploadError } = await adminClient.storage
      .from("avatars")
      .upload(filePath, buffer, {
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: `Erro no upload: ${uploadError.message}` }, { status: 500 });
    }

    // Pegar URL pública
    const { data: urlData } = adminClient.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const publicUrl = urlData?.publicUrl;
    if (!publicUrl) {
      return NextResponse.json({ error: "Erro ao gerar URL" }, { status: 500 });
    }

    // Cache-bust
    const avatarUrl = `${publicUrl}?t=${Date.now()}`;

    // Atualizar perfil com avatar_url
    const { data: profile, error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .select("*")
      .single();

    if (updateError) {
      console.error("Profile update error:", updateError);
      return NextResponse.json({ error: `Erro ao atualizar perfil: ${updateError.message}` }, { status: 500 });
    }

    return NextResponse.json({ user: { ...profile, name: profile.display_name }, avatarUrl });
  } catch (error: any) {
    console.error("Avatar upload error:", error);
    return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 });
  }
}
