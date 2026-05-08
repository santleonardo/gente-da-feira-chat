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

    const { data: messages, error } = await supabase
      .from("messages")
      .select(
        `
        *,
        sender:profiles(id, display_name, username, avatar)
      `
      )
      .eq("dm_id", id)
      .eq("target_type", "dm")
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) throw error;
    return NextResponse.json({ messages: messages || [] });
  } catch (error) {
    console.error(`[GET /api/dm/${id}/messages]`, error);
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
        dm_id: id,
        target_type: "dm",
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
    console.error(`[POST /api/dm/${id}/messages]`, error);
    return NextResponse.json(
      { error: "Erro ao enviar mensagem" },
      { status: 500 }
    );
  }
}
