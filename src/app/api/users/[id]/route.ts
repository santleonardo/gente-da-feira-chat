import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = await createClient();

    const { data: profile, error } = await supabase
      .from("profiles")
      .select(`
        *,
        posts(count)
      `)
      .eq("id", id)
      .single();

    if (error || !profile) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    const formatted = {
      ...profile,
      name: profile.display_name,
      _count: { posts: profile.posts?.[0]?.count || 0 },
      posts: undefined,
    };

    return NextResponse.json({ user: formatted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const data = await req.json();
    const { data: profile, error } = await supabase
      .from("profiles")
      .update({
        display_name: data.name,
        bio: data.bio,
        neighborhood: data.neighborhood,
        theme: data.theme,
        username: data.username,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ user: { ...profile, name: profile.display_name } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
