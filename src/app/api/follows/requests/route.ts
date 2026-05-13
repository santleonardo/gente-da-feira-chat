import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { data: requests, error } = await supabase
      .from("follows")
      .select("id, follower_id, created_at, follower:profiles!follows_follower_id_fkey(id, display_name, username, avatar_url, neighborhood, bio)")
      .eq("following_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ requests: requests || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { requestId, action } = await req.json();
    if (!requestId || !action) return NextResponse.json({ error: "requestId e action são obrigatórios" }, { status: 400 });
    if (action !== "accept" && action !== "reject") return NextResponse.json({ error: "action deve ser 'accept' ou 'reject'" }, { status: 400 });

    const { data: followRow, error: fetchErr } = await supabase
      .from("follows")
      .select("id, follower_id, following_id, status")
      .eq("id", requestId)
      .eq("following_id", user.id)
      .eq("status", "pending")
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!followRow) return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 });

    if (action === "accept") {
      const { error: updateErr } = await supabase.from("follows").update({ status: "accepted" }).eq("id", requestId);
      if (updateErr) throw updateErr;

      await supabase.from("notifications").insert({
        user_id: followRow.follower_id,
        type: "follow_accepted",
        from_user_id: user.id,
        message: "aceitou sua solicitação de seguir",
      });

      return NextResponse.json({ accepted: true });
    } else {
      const { error: delErr } = await supabase.from("follows").delete().eq("id", requestId);
      if (delErr) throw delErr;
      return NextResponse.json({ rejected: true });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
