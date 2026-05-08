import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod/v4";

const sendMessageSchema = z.object({
  content: z.string().min(1, "Mensagem não pode ser vazia").max(2000, "Mensagem muito longa"),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    const { data: messages, error } = await supabase
      .from("messages")
      .select(
        `
        *,
        sender:profiles(id, display_name, username, avatar)
      `
      )
      .eq("room_id", id)
      .eq("target_type", "room")
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) throw error;
    return NextResponse.json({ messages: messages || [] });
  } catch (error) {
    console.error(`[GET /api/rooms/${id}/messages]`, error);
    return NextResponse.json(
      { error: "Erro ao buscar mensagens" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const { content } = sendMessageSchema.parse(body);

    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        content,
        sender_id: user.id,
        room_id: id,
        target_type: "room",
      })
      .select(
        `
        *,
        sender:profiles(id, display_name, username, avatar)
      `
      )
      .single();

    if (error) throw error;
    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    console.error(`[POST /api/rooms/${id}/messages]`, error);
    return NextResponse.json(
      { error: "Erro ao enviar mensagem" },
      { status: 500 }
    );
  }
}
