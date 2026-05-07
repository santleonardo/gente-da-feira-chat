import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId) return NextResponse.json({ conversations: [] });

    const { data: conversations, error } = await supabase
      .from("direct_chats")
      .select(`
        *,
        initiator:profiles!direct_chats_initiator_id_fkey(id, display_name, username, avatar),
        receiver:profiles!direct_chats_receiver_id_fkey(id, display_name, username, avatar)
      `)
      .or(`initiator_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ conversations: conversations || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { receiverId } = await req.json();
    if (user.id === receiverId) {
      return NextResponse.json({ error: "Não pode conversar consigo" }, { status: 400 });
    }

    // Ordem consistente para UNIQUE constraint
    const [a, b] = user.id < receiverId
      ? [user.id, receiverId]
      : [receiverId, user.id];

    // Verificar se já existe
    const { data: existing } = await supabase
      .from("direct_chats")
      .select(`
        *,
        initiator:profiles!direct_chats_initiator_id_fkey(id, display_name, username, avatar),
        receiver:profiles!direct_chats_receiver_id_fkey(id, display_name, username, avatar)
      `)
      .eq("initiator_id", a)
      .eq("receiver_id", b)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ conversation: existing });
    }

    // Criar nova conversa
    const { data: conversation, error } = await supabase
      .from("direct_chats")
      .insert({
        initiator_id: a,
        receiver_id: b,
      })
      .select(`
        *,
        initiator:profiles!direct_chats_initiator_id_fkey(id, display_name, username, avatar),
        receiver:profiles!direct_chats_receiver_id_fkey(id, display_name, username, avatar)
      `)
      .single();

    if (error) throw error;
    return NextResponse.json({ conversation });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
