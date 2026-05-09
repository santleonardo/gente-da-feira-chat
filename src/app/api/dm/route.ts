import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { data: conversations, error } = await supabase
      .from("direct_chats")
      .select(`
        *,
        initiator:profiles!direct_chats_initiator_id_fkey(id, display_name, username, avatar_url),
        receiver:profiles!direct_chats_receiver_id_fkey(id, display_name, username, avatar_url)
      `)
      .or(`initiator_id.eq.${user.id},receiver_id.eq.${user.id}`)
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
    if (!receiverId) return NextResponse.json({ error: "receiverId obrigatório" }, { status: 400 });
    if (user.id === receiverId) return NextResponse.json({ error: "Não pode conversar consigo" }, { status: 400 });

    const [a, b] = user.id < receiverId ? [user.id, receiverId] : [receiverId, user.id];

    const { data: existing } = await supabase.from("direct_chats")
      .select(`*, initiator:profiles!direct_chats_initiator_id_fkey(id, display_name, username, avatar_url), receiver:profiles!direct_chats_receiver_id_fkey(id, display_name, username, avatar_url)`)
      .eq("initiator_id", a).eq("receiver_id", b).maybeSingle();

    if (existing) return NextResponse.json({ conversation: existing });

    const { data: conversation, error } = await supabase.from("direct_chats")
      .insert({ initiator_id: a, receiver_id: b })
      .select(`*, initiator:profiles!direct_chats_initiator_id_fkey(id, display_name, username, avatar_url), receiver:profiles!direct_chats_receiver_id_fkey(id, display_name, username, avatar_url)`)
      .single();

    if (error) throw error;
    return NextResponse.json({ conversation });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
