import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = await createClient();

    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("is_private")
      .eq("id", id)
      .single();

    const isPrivate = targetProfile?.is_private || false;

    if (isPrivate) {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const isOwnProfile = authUser?.id === id;

      if (!isOwnProfile && authUser) {
        const { data: followRow } = await supabase
          .from("follows")
          .select("id, status")
          .eq("follower_id", authUser.id)
          .eq("following_id", id)
          .maybeSingle();

        // Só mostrar posts se o status for "accepted" (não pending)
        if (!followRow || followRow.status !== "accepted") {
          return NextResponse.json({ posts: [], _privacy: { isRestricted: true } });
        }
      } else if (!authUser) {
        return NextResponse.json({ posts: [], _privacy: { isRestricted: true } });
      }
    }

    const { data: posts, error } = await supabase
      .from("posts")
      .select(`
        id,
        content,
        image_url,
        neighborhood,
        created_at,
        author_id,
        reactions(user_id, type)
      `)
      .eq("author_id", id)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    return NextResponse.json({ posts: posts || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
