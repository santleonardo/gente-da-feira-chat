import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = await createClient();

    const { data: messages, error } = await supabase
      .from("messages")
      .select(`
        *,
        sender:profiles(id, display_name, username, avatar)
      `)
      .eq("dm_id", id)
      .eq("target_type", "dm")
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      .limit(50);

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

    const { content } = await req.json();

    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        content,
        sender_id: user.id,
        dm_id: id,
        target_type: "dm",
      })
      .select(`
        *,
        sender:profiles(id, display_name, username, avatar)
      `)
      .single();

    if (error) throw error;
    return NextResponse.json({ message });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
