import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId é obrigatório" }, { status: 400 });
    }

    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("is_private, hide_following, hide_followers, approve_followers")
      .eq("id", userId)
      .single();

    const isPrivate = targetProfile?.is_private || false;
    const hideFollowing = targetProfile?.hide_following || false;
    const hideFollowers = targetProfile?.hide_followers || false;
    const approveFollowers = targetProfile?.approve_followers || false;

    const { data: following, error: fErr } = await supabase
      .from("follows")
      .select("following_id, created_at, following:profiles!follows_following_id_fkey(id, display_name, username, avatar_url, neighborhood, bio)")
      .eq("follower_id", userId)
      .eq("status", "accepted")
      .order("created_at", { ascending: false });

    if (fErr) throw fErr;

    const { data: followers, error: foErr } = await supabase
      .from("follows")
      .select("follower_id, created_at, follower:profiles!follows_follower_id_fkey(id, display_name, username, avatar_url, neighborhood, bio)")
      .eq("following_id", userId)
      .eq("status", "accepted")
      .order("created_at", { ascending: false });

    if (foErr) throw foErr;

    let pendingRequests: any[] = [];
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const isOwnProfile = authUser?.id === userId;

    if (isOwnProfile) {
      const { data: pending } = await supabase
        .from("follows")
        .select("id, follower_id, created_at, follower:profiles!follows_follower_id_fkey(id, display_name, username, avatar_url, neighborhood, bio)")
        .eq("following_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      pendingRequests = pending || [];
    }

    let isFollowing = false;
    let isPending = false;

    if (authUser && !isOwnProfile) {
      const { data: followRow } = await supabase
        .from("follows")
        .select("id, status")
        .eq("follower_id", authUser.id)
        .eq("following_id", userId)
        .maybeSingle();
      if (followRow) {
        isFollowing = followRow.status === "accepted";
        isPending = followRow.status === "pending";
      }
    }

    const followingCount = following?.length || 0;
    const followersCount = followers?.length || 0;
    const pendingCount = pendingRequests.length;

    const canSeeFollowing = isOwnProfile || !hideFollowing;
    const canSeeFollowers = isOwnProfile || !hideFollowers;
    const isRestricted = isPrivate && !isOwnProfile && !isFollowing;

    const filteredFollowing = canSeeFollowing ? (following || []) : [];
    const filteredFollowers = canSeeFollowers ? (followers || []) : [];

    return NextResponse.json({
      followingCount,
      followersCount,
      isFollowing,
      isPending,
      approveFollowers,
      following: filteredFollowing,
      followers: filteredFollowers,
      pendingRequests: isOwnProfile ? pendingRequests : [],
      pendingCount: isOwnProfile ? pendingCount : 0,
      _privacy: {
        hide_following: hideFollowing,
        hide_followers: hideFollowers,
        approve_followers: approveFollowers,
        canSeeFollowing,
        canSeeFollowers,
        isRestricted,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { targetUserId } = await req.json();
    if (!targetUserId) {
      return NextResponse.json({ error: "targetUserId é obrigatório" }, { status: 400 });
    }

    if (user.id === targetUserId) {
      return NextResponse.json({ error: "Não pode seguir a si mesmo" }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from("follows")
      .select("id, status")
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId)
      .maybeSingle();

    if (existing) {
      const { error: delErr } = await supabase
        .from("follows")
        .delete()
        .eq("id", existing.id);

      if (delErr) throw delErr;
      return NextResponse.json({ following: false, pending: false });
    } else {
      const { data: targetProfile } = await supabase
        .from("profiles")
        .select("approve_followers")
        .eq("id", targetUserId)
        .single();

      const approveFollowers = targetProfile?.approve_followers || false;
      const status = approveFollowers ? "pending" : "accepted";

      const { error: insertErr } = await supabase
        .from("follows")
        .insert({ follower_id: user.id, following_id: targetUserId, status });

      if (insertErr) throw insertErr;

      if (approveFollowers) {
        return NextResponse.json({ following: false, pending: true });
      } else {
        return NextResponse.json({ following: true, pending: false });
      }
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
