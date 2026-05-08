"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Heart, MessageCircle, Trash2 } from "lucide-react";
import { getInitials, getAvatarColor, timeAgo } from "@/lib/constants";
import { useRealtimeMessages } from "@/hooks/use-realtime";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface PostWithAuthor {
  id: string;
  content: string;
  neighborhood?: string | null;
  created_at: string;
  author_id: string;
  author: {
    id: string;
    display_name: string;
    username: string;
    avatar?: string | null;
    neighborhood?: string | null;
  };
  reactions: { user_id: string; type: string }[];
}

export function FeedView() {
  const { profile } = useStore();
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    const nb = profile?.neighborhood || "all";
    try {
      const res = await fetch(`/api/posts?neighborhood=${nb}&limit=30`);
      const data = await res.json();
      setPosts(data.posts || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [profile?.neighborhood]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const handleNewPost = useCallback((payload: any) => {
    const fetchAuthor = async () => {
      const supabase = createClient();
      const { data: author } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar, neighborhood")
        .eq("id", payload.author_id)
        .single();

      const { data: reactions } = await supabase
        .from("reactions")
        .select("user_id, type")
        .eq("post_id", payload.id);

      const newPost: PostWithAuthor = {
        ...payload,
        author: author || { id: payload.author_id, display_name: "Usuário", username: "" },
        reactions: reactions || [],
      };
      setPosts((prev) => {
        if (prev.some((p) => p.id === newPost.id)) return prev;
        return [newPost, ...prev];
      });
    };
    fetchAuthor();
  }, []);

  useRealtimeMessages({
    table: "posts",
    onInsert: handleNewPost,
    enabled: !!profile,
  });

  const handlePost = async () => {
    if (!content.trim() || !profile) return;
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), neighborhood: profile.neighborhood }),
      });
      const data = await res.json();
      if (data.post) {
        setPosts((prev) => {
          if (prev.some((p) => p.id === data.post.id)) return prev;
          return [data.post, ...prev];
        });
        setContent("");
        toast.success("Post publicado!");
      }
    } catch { toast.error("Erro ao publicar"); }
  };

  const handleLike = async (postId: string) => {
    if (!profile) return;
    try {
      const res = await fetch("/api/posts/reaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, type: "like" }),
      });
      const data = await res.json();
      if (data.reacted !== undefined) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  reactions: data.reacted
                    ? [...p.reactions, { user_id: profile.id, type: "like" }]
                    : p.reactions.filter((r) => r.user_id !== profile.id),
                }
              : p
          )
        );
      }
    } catch { /* silent */ }
  };

  const handleDelete = async (postId: string) => {
    try {
      await fetch(`/api/posts?id=${postId}`, { method: "DELETE" });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success("Post excluído");
    } catch { toast.error("Erro ao excluir"); }
  };

  if (loading) return <FeedSkeleton />;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className={`${getAvatarColor(profile?.id || "")} text-xs text-white`}>
              {getInitials(profile?.display_name || "?")}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <Textarea
              placeholder="O que está acontecendo no seu bairro?"
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 500))}
              className="min-h-[72px] resize-none border-0 bg-muted/50 text-sm focus-visible:ring-1"
              rows={2}
            />
            <div className="flex items-center justify-between">
              <span className={`text-xs ${content.length > 450 ? "text-destructive" : "text-muted-foreground"}`}>
                {content.length}/500
              </span>
              <Button
                size="sm"
                disabled={!content.trim()}
                onClick={handlePost}
                className="rounded-full px-4"
              >
                Publicar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {posts.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Nenhum post ainda. Seja o primeiro a publicar!
        </p>
      )}

      {posts.map((post) => {
        const liked = post.reactions?.some((r) => r.user_id === profile?.id);
        const likeCount = post.reactions?.length || 0;

        return (
          <div key={post.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start gap-3">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback className={`${getAvatarColor(post.author.id)} text-xs text-white`}>
                  {getInitials(post.author.display_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{post.author.display_name}</span>
                  <span className="text-xs text-muted-foreground">@{post.author.username}</span>
                  {post.author.neighborhood && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {post.author.neighborhood}
                    </Badge>
                  )}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed">{post.content}</p>
                <div className="mt-3 flex items-center gap-4 text-muted-foreground">
                  <button
                    onClick={() => handleLike(post.id)}
                    className="flex items-center gap-1.5 text-xs transition-colors hover:text-rose-500"
                  >
                    <Heart className={`h-4 w-4 ${liked ? "fill-rose-500 text-rose-500" : ""}`} />
                    {likeCount > 0 && likeCount}
                  </button>
                  <button className="flex items-center gap-1.5 text-xs hover:text-primary">
                    <MessageCircle className="h-4 w-4" />
                  </button>
                  <span className="text-xs">{timeAgo(post.created_at)}</span>
                  {post.author_id === profile?.id && (
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border bg-card p-4 animate-pulse">
          <div className="flex gap-3">
            <div className="h-9 w-9 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-3 w-full rounded bg-muted" />
              <div className="h-3 w-3/4 rounded bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
