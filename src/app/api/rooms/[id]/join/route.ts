import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod/v4";

const joinRoomSchema = z.object({
  userId: z.string().min(1, "ID do usuário obrigatório"),
  roomId: z.string().min(1, "ID da sala obrigatório"),
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
    const { userId, roomId } = joinRoomSchema.parse(body);

    if (userId !== user.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    // Verificar se já é membro
    const { data: existing } = await supabase
      .from("room_members")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ joined: true });
    }

    const { error } = await supabase.from("room_members").insert({
      room_id: roomId,
      user_id: userId,
    });

    if (error) throw error;
    return NextResponse.json({ joined: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    console.error("[POST /api/rooms/join]", error);
    return NextResponse.json(
      { error: "Erro ao entrar na sala" },
      { status: 500 }
    );
  }
}
