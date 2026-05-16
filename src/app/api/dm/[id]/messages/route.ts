import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { data: chat } = await supabase.from("direct_chats").select("id").eq("id", id).or(`initiator_id.eq.${user.id},receiver_id.eq.${user.id}`).maybeSingle();
    if (!chat) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const { data: messages, error } = await supabase.from("messages")
      .select(`*, sender:profiles(id, display_name, username, avatar_url)`)
      .eq("dm_id", id).eq("target_type", "dm").eq("is_deleted", false)
      .order("created_at", { ascending: true }).limit(50);

    if (error) throw error;
    return NextResponse.json({ messages: messages || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { data: chat } = await supabase.from("direct_chats").select("id").eq("id", id).or(`initiator_id.eq.${user.id},receiver_id.eq.${user.id}`).maybeSingle();
    if (!chat) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const body = await req.json();
    const { content, image_url, video_url, audio_url } = body;

    if ((!content || !content.trim()) && !image_url && !video_url && !audio_url) {
      return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
    }
    if (content && content.length > 2000) {
      return NextResponse.json({ error: "Mensagem muito longa (máx 2000 chars)" }, { status: 400 });
    }

    const insertData: any = {
      content: content?.trim() || "",
      sender_id: user.id,
      dm_id: id,
      target_type: "dm",
    };
    if (image_url) insertData.image_url = image_url;
    if (video_url) insertData.video_url = video_url;
    if (audio_url) insertData.audio_url = audio_url;

    const { data: message, error } = await supabase.from("messages")
      .insert(insertData)
      .select(`*, sender:profiles(id, display_name, username, avatar_url)`).single();

    if (error) throw error;
    return NextResponse.json({ message });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
