"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Heart } from "lucide-react";
import { timeAgo } from "@/lib/constants";
import { UserAvatar } from "./UserAvatar";

interface PostCardProps {
  post: {
    id: string;
    content: string;
    created_at: string;
    author: {
      id: string;
      display_name: string;
      username: string;
      avatar_url?: string | null;
      neighborhood?: string | null;
    };
    reactions: { user_id: string; type: string }[];
  };
}

export function PostCard({ post }: PostCardProps) {
  const { profile } = useStore();
  const [liked, setLiked] = useState(post.reactions.some((r) => r.user_id === profile?.id));
  const [likeCount, setLikeCount] = useState(post.reactions.length);
  const [loading, setLoading] = useState(false);

  const handleLike = async () => {
    if (loading || !profile) return;
    setLoading(true);
    try {
      const res = await fetch("/api/posts/reaction", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: post.id }) });
      const data = await res.json();
      setLiked(data.reacted);
      setLikeCount((c) => (data.reacted ? c + 1 : c - 1));
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3 mb-3">
        <UserAvatar user={post.author} className="h-10 w-10" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{post.author.display_name}</span>
            {post.author.neighborhood && (<span className="text-[10px] px-1.5 py-0 rounded-full bg-secondary text-secondary-foreground">{post.author.neighborhood}</span>)}
          </div>
          <p className="text-xs text-muted-foreground">@{post.author.username} · {timeAgo(post.created_at)}</p>
        </div>
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap mb-3">{post.content}</p>
      <div className="flex items-center gap-4">
        <button onClick={handleLike} className={`flex items-center gap-1.5 text-sm transition-colors ${liked ? "text-rose-500" : "text-muted-foreground hover:text-rose-500"}`}>
          <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
          {likeCount > 0 && <span>{likeCount}</span>}
        </button>
      </div>
    </div>
  );
}
