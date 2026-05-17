import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

    const { data: messages, error } = await supabase.from("messages")
      .select(`*, sender:profiles(id, display_name, username, avatar_url)`)
      .eq("room_id", id).eq("target_type", "room").eq("is_deleted", false)
      .order("created_at", { ascending: true }).limit(limit);

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

    const body = await req.json();
    const { content, media_url, media_type } = body;

    // At least content or media_url must be provided
    if ((!content || !content.trim()) && !media_url) {
      return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
    }
    if (content && content.length > 2000) {
      return NextResponse.json({ error: "Mensagem muito longa (máx 2000 chars)" }, { status: 400 });
    }

    // Validate media_type
    if (media_url && !["image", "video", "audio"].includes(media_type)) {
      return NextResponse.json({ error: "Tipo de mídia inválido" }, { status: 400 });
    }

    const insertData: any = {
      sender_id: user.id,
      room_id: id,
      target_type: "room",
    };

    if (content && content.trim()) {
      insertData.content = content.trim();
    } else {
      insertData.content = null;
    }

    if (media_url) {
      insertData.media_url = media_url;
      insertData.media_type = media_type;
    }

    const { data: message, error } = await supabase.from("messages")
      .insert(insertData)
      .select(`*, sender:profiles(id, display_name, username, avatar_url)`)
      .single();

    if (error) throw error;
    return NextResponse.json({ message });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
