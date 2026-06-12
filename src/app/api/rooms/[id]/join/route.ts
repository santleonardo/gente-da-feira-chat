import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import bcrypt from "bcryptjs";

// POST /api/rooms/[id]/join
// Body (opcional): { password }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: roomId } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    // Busca sala
    const { data: room } = await supabase
      .from("rooms")
      .select("id, is_active, is_open, max_members, member_count, password_hash")
      .eq("id", roomId)
      .single();

    if (!room) return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
    if (!room.is_active) return NextResponse.json({ error: "Sala inativa" }, { status: 403 });

    // Verifica se já é membro
    const { data: existing } = await supabase
      .from("room_members")
      .select("id, is_banned, banned_until, role")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      // Se estava banido mas o tempo expirou, remove o ban
      if (existing.is_banned && existing.banned_until && new Date(existing.banned_until) < new Date()) {
        await supabase
          .from("room_members")
          .update({ is_banned: false, banned_until: null })
          .eq("room_id", roomId)
          .eq("user_id", user.id);
      } else if (existing.is_banned) {
        const until = existing.banned_until
          ? ` até ${new Date(existing.banned_until).toLocaleDateString("pt-BR")}`
          : " permanentemente";
        return NextResponse.json({ error: `Você está banido desta sala${until}.` }, { status: 403 });
      }
      return NextResponse.json({ joined: true });
    }

    // Sala fechada
    if (!room.is_open) {
      return NextResponse.json({ error: "Esta sala está fechada para novos membros." }, { status: 403 });
    }

    // Limite de membros
    if (room.member_count >= room.max_members) {
      return NextResponse.json({ error: `Sala lotada (máx ${room.max_members} membros).` }, { status: 403 });
    }

    // Verificar senha
    if (room.password_hash) {
      const body = await req.json().catch(() => ({}));
      const provided = (body.password || "").trim();
      if (!provided) {
        return NextResponse.json({ error: "Esta sala é privada. Informe a senha.", requiresPassword: true }, { status: 403 });
      }
      const match = await bcrypt.compare(provided, room.password_hash);
      if (!match) {
        return NextResponse.json({ error: "Senha incorreta.", requiresPassword: true }, { status: 403 });
      }
    }

    const { error } = await supabase.from("room_members").insert({
      room_id: roomId,
      user_id: user.id,
      role: "member",
    });

    if (error) throw error;
    return NextResponse.json({ joined: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
