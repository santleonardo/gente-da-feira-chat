"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { UserAvatar } from "./UserAvatar";
import { useState, useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import type { Profile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Trash2, Send, ChevronDown, ChevronUp, Reply } from "lucide-react";
import { getInitials, getAvatarColor, timeAgo } from "@/lib/constants";
import { toast } from "sonner";

const REACTION_EMOJIS = ["😂", "😔", "😲", "😡", "😍"];

interface ReactionGroup {
  type: string;
  count: number;
  reacted: boolean;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  parent_id: string | null;
  reactions: { user_id: string; type: string }[];
  author: {
    id: string;
    display_name: string;
    username: string;
    avatar?: string | null;
    avatar_url?: string | null;
    neighborhood?: string | null;
  };
  replies?: Comment[];
}

interface PostWithAuthor {
  id: string;
  content: string;
  neighborhood?: string | null;
  created_at: string;
  author_id: string;
  comment_count?: number;
  author: {
    id: string;
    display_name: string;
    username: string;
    avatar?: string | null;
    avatar_url?: string | null;
    neighborhood?: string | null;
  };
  reactions: { user_id: string; type: string }[];
}

function buildReactionGroups(reactions: { user_id: string; type: string }[], userId?: string): ReactionGroup[] {
  const map = new Map<string, { count: number; reacted: boolean }>();
  for (const r of reactions) {
    const existing = map.get(r.type) || { count: 0, reacted: false };
    existing.count++;
    if (r.user_id === userId) existing.reacted = true;
    map.set(r.type, existing);
  }
  const groups: ReactionGroup[] = [];
  for (const type of REACTION_EMOJIS) {
    const data = map.get(type);
    if (data) groups.push({ type, ...data });
  }
  for (const [type, data] of map) {
    if (!REACTION_EMOJIS.includes(type)) {
      groups.push({ type, ...data });
    }
  }
  return groups;
}

function buildCommentTree(flatComments: Comment[]): Comment[] {
  const map = new Map<string, Comment>();
  const roots: Comment[] = [];
  for (const c of flatComments) {
    map.set(c.id, { ...c, replies: [] });
  }
  for (const c of flatComments) {
    const node = map.get(c.id)!;
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.replies!.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export function FeedView() {
  const { profile } = useStore();
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const nb = profile?.neighborhood || "all";
    fetch(`/api/posts?neighborhood=${nb}&limit=30`)
      .then((r) => r.json())
      .then((data) => setPosts(data.posts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profile?.neighborhood]);

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
        setPosts((prev) => [{ ...data.post, comment_count: 0 }, ...prev]);
        setContent("");
        toast.success("Post publicado!");
      } else if (data.error) {
        toast.error(data.error);
      }
    } catch { toast.error("Erro ao publicar"); }
  };

  const handleReaction = async (postId: string, type: string) => {
    if (!profile) return;
    try {
      const res = await fetch("/api/posts/reaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, type }),
      });
      const data = await res.json();
      if (data.reacted !== undefined) {
        setPosts((prev) =>
          prev.map((p) => {
            if (p.id !== postId) return p;
            const reactions = data.reacted
              ? [...p.reactions, { user_id: profile.id, type }]
              : p.reactions.filter((r) => !(r.user_id === profile.id && r.type === type));
            return { ...p, reactions };
          })
        );
      }
    } catch { /* silent */ }
  };

  const handleCommentReaction = async (commentId: string, type: string) => {
    if (!profile) return;
    try {
      const res = await fetch("/api/comments/reaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, type }),
      });
      const data = await res.json();
      if (data.reacted !== undefined) {
        window.dispatchEvent(new CustomEvent("comment-reaction", {
          detail: { commentId, type, reacted: data.reacted, userId: profile.id },
        }));
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

  const updateCommentCount = (postId: string, delta: number) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, comment_count: Math.max(0, (p.comment_count || 0) + delta) }
          : p
      )
    );
  };

  if (loading) return <FeedSkeleton />;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-start gap-3">
          <UserAvatar user={{ id: profile?.id || "", display_name: profile?.display_name || "?", avatar: profile?.avatar, avatar_url: profile?.avatar_url }} className="h-9 w-9 shrink-0" />
          <div className="flex-1 space-y-2">
            <textarea
              placeholder="O que está acontecendo no seu bairro?"
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 500))}
              className="w-full min-h-[72px] resize-none rounded-lg border-0 bg-muted/50 p-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              rows={2}
            />
            <div className="flex items-center justify-between">
              <span className={`text-xs ${content.length > 450 ? "text-destructive" : "text-muted-foreground"}`}>
                {content.length}/500
              </span>
              <Button size="sm" disabled={!content.trim()} onClick={handlePost} className="rounded-full px-4">
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

      {posts.map((post) => (
        <PostThread
          key={post.id}
          post={post}
          profile={profile}
          onReaction={handleReaction}
          onCommentReaction={handleCommentReaction}
          onDelete={handleDelete}
          onUpdateCommentCount={updateCommentCount}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PostThread
// ═══════════════════════════════════════════════════════════
function PostThread({
  post,
  profile,
  onReaction,
  onCommentReaction,
  onDelete,
  onUpdateCommentCount,
}: {
  post: PostWithAuthor;
  profile: Profile | null;
  onReaction: (postId: string, type: string) => void;
  onCommentReaction: (commentId: string, type: string) => void;
  onDelete: (postId: string) => void;
  onUpdateCommentCount: (postId: string, delta: number) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const commentCount = post.comment_count || 0;
  const reactionGroups = buildReactionGroups(post.reactions, profile?.id);
  const hasReactions = reactionGroups.length > 0;

  useEffect(() => {
    const handler = (e: Event) => {
      const { commentId, type, reacted, userId } = (e as CustomEvent).detail;
      const updateComments = (comments: Comment[]): Comment[] =>
        comments.map((c) => {
          if (c.id === commentId) {
            const reactions = reacted
              ? [...c.reactions, { user_id: userId, type }]
              : c.reactions.filter((r) => !(r.user_id === userId && r.type === type));
            return { ...c, reactions };
          }
          if (c.replies && c.replies.length > 0) {
            return { ...c, replies: updateComments(c.replies) };
          }
          return c;
        });
      setComments((prev) => updateComments(prev));
    };
    window.addEventListener("comment-reaction", handler);
    return () => window.removeEventListener("comment-reaction", handler);
  }, []);

  const fetchComments = async () => {
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`);
      const data = await res.json();
      if (data.comments) {
        setComments(buildCommentTree(data.comments));
      }
    } catch { /* silent */ }
    setCommentsLoading(false);
  };

  const toggleComments = () => {
    if (!showComments && comments.length === 0) fetchComments();
    setShowComments(!showComments);
  };

  const openAndFocus = () => {
    if (!showComments) {
      if (comments.length === 0) fetchComments();
      setShowComments(true);
    }
    setTimeout(() => commentInputRef.current?.focus(), 100);
  };

  const startReply = (commentId: string, authorName: string) => {
    setReplyTo({ id: commentId, name: authorName });
    if (!showComments) {
      if (comments.length === 0) fetchComments();
      setShowComments(true);
    }
    setTimeout(() => commentInputRef.current?.focus(), 100);
  };

  const cancelReply = () => setReplyTo(null);

  const addReplyToTree = (comments: Comment[], parentId: string, newReply: Comment): Comment[] => {
    return comments.map((c) => {
      if (c.id === parentId) {
        return { ...c, replies: [...(c.replies || []), newReply] };
      }
      if (c.replies && c.replies.length > 0) {
        return { ...c, replies: addReplyToTree(c.replies, parentId, newReply) };
      }
      return c;
    });
  };

  const submitComment = async () => {
    if (!commentInput.trim() || !profile || submitting) return;
    setSubmitting(true);
    try {
      const body: { content: string; parentId?: string } = { content: commentInput.trim() };
      if (replyTo) body.parentId = replyTo.id;
      const res = await fetch(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.comment) {
        const newComment: Comment = { ...data.comment, replies: [] };
        if (replyTo) {
          setComments((prev) => addReplyToTree(prev, replyTo.id, newComment));
        } else {
          setComments((prev) => [...prev, newComment]);
        }
        setCommentInput("");
        setReplyTo(null);
        onUpdateCommentCount(post.id, 1);
        if (!showComments) setShowComments(true);
      } else if (data.error) {
        toast.error(data.error);
      }
    } catch {
      toast.error("Erro ao comentar");
    }
    setSubmitting(false);
  };

  const deleteComment = async (commentId: string) => {
    try {
      const res = await fetch(`/api/posts/${post.id}/comments?commentId=${commentId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        const removeRecursive = (comments: Comment[]): Comment[] =>
          comments
            .filter((c) => c.id !== commentId)
            .map((c) => ({ ...c, replies: c.replies ? removeRecursive(c.replies) : [] }));
        setComments((prev) => removeRecursive(prev));
        onUpdateCommentCount(post.id, -1);
      }
    } catch { toast.error("Erro ao excluir comentário"); }
  };

  return (
    <div className="rounded-xl border bg-card">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <UserAvatar user={post.author} className="h-9 w-9 shrink-0" />
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
            <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>

            {hasReactions && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {reactionGroups.map((group) => (
                  <button
                    key={group.type}
                    onClick={() => onReaction(post.id, group.type)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                      group.reacted
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="text-sm">{group.type}</span>
                    <span className="text-[10px]">{group.count}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-2 flex items-center gap-1 text-muted-foreground">
              {profile && (
                <div className="flex items-center gap-0.5">
                  {REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => onReaction(post.id, emoji)}
                      className="rounded p-1 text-base transition-transform hover:scale-125 hover:bg-muted"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={openAndFocus} className="flex items-center gap-1.5 text-xs transition-colors hover:text-primary ml-2">
                <MessageCircle className="h-4 w-4" />
                {commentCount > 0 && commentCount}
              </button>
              <span className="text-xs ml-2">{timeAgo(post.created_at)}</span>
              {post.author_id === profile?.id && (
                <button onClick={() => onDelete(post.id)} className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {(commentCount > 0 || comments.length > 0) && (
        <button onClick={toggleComments} className="flex w-full items-center justify-center gap-1.5 border-t py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-primary">
          {showComments ? (
            <>Ocultar comentários <ChevronUp className="h-3 w-3" /></>
          ) : (
            <>{commentCount || comments.length} comentário{(commentCount || comments.length) !== 1 ? "s" : ""} <ChevronDown className="h-3 w-3" /></>
          )}
        </button>
      )}

      {showComments && (
        <div className="border-t bg-muted/20">
          <div className="max-h-80 overflow-y-auto px-4 py-3">
            {commentsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="flex gap-2.5 animate-pulse">
                    <div className="h-6 w-6 rounded-full bg-muted" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-24 rounded bg-muted" />
                      <div className="h-3 w-full rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            ) : comments.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-2">
                Nenhum comentário ainda. Seja o primeiro!
              </p>
            ) : (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    profile={profile}
                    onDelete={deleteComment}
                    onReply={startReply}
                    onReaction={onCommentReaction}
                    depth={0}
                  />
                ))}
              </div>
            )}
          </div>

          {profile && (
            <div className="border-t px-4 py-2.5">
              {replyTo && (
                <div className="flex items-center gap-2 mb-1.5">
                  <Reply className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">
                    Respondendo a <strong>@{replyTo.name}</strong>
                  </span>
                  <button onClick={cancelReply} className="text-[10px] text-muted-foreground hover:text-destructive ml-1">
                    Cancelar
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <UserAvatar user={{ id: profile.id, display_name: profile.display_name, avatar: profile.avatar, avatar_url: profile.avatar_url }} className="h-6 w-6 shrink-0" />
                <Input
                  ref={commentInputRef}
                  placeholder={replyTo ? `Responder @${replyTo.name}...` : "Escreva um comentário..."}
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value.slice(0, 300))}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submitComment()}
                  className="h-8 text-xs border-0 bg-muted/50 focus-visible:ring-1"
                />
                <Button size="icon" onClick={submitComment} disabled={!commentInput.trim() || submitting} className="h-8 w-8 shrink-0 rounded-full">
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {!showComments && profile && (
        <div className="flex items-center gap-2 border-t px-4 py-2.5">
          <UserAvatar user={{ id: profile.id, display_name: profile.display_name, avatar: profile.avatar, avatar_url: profile.avatar_url }} className="h-6 w-6 shrink-0" />
          <Input
            placeholder="Escreva um comentário..."
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value.slice(0, 300))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                if (commentInput.trim()) openAndFocus();
              }
            }}
            onFocus={openAndFocus}
            className="h-8 text-xs border-0 bg-muted/50 focus-visible:ring-1"
          />
        </div>
      )}
    </div>
  );
