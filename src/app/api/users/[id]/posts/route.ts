import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = await createClient();

    const { data: posts, error } = await supabase
      .from("posts")
      .select(`id, content, neighborhood, created_at, author_id, reactions(user_id, type)`)
      .eq("author_id", id).eq("is_deleted", false)
      .order("created_at", { ascending: false }).limit(20);

    if (error) throw error;
    return NextResponse.json({ posts: posts || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
