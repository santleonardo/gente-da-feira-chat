"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef } from "react";
import { useStore, Profile } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Heart, MessageCircle, Trash2, Send, ChevronDown, ChevronUp, Reply } from "lucide-react";
import { getInitials, getAvatarColor, timeAgo } from "@/lib/constants";
import { UserAvatar } from "./UserAvatar";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════
// Emoji reactions padrão
// ═══════════════════════════════════════════════════════════
const REACTION_EMOJIS = [
  { type: "like", emoji: "❤️", label: "Curtir" },
  { type: "laugh", emoji: "😂", label: "Engraçado" },
  { type: "sad", emoji: "😔", label: "Triste" },
  { type: "wow", emoji: "😲", label: "Uau" },
  { type: "angry", emoji: "😡", label: "Bravo" },
  { type: "love", emoji: "😍", label: "Amei" },
] as const;

function buildReactionGroups(reactions: { user_id: string; type: string }[]) {
  const groups: Record<string, { emoji: string; count: number; types: string[] }> = {};
  for (const r of reactions) {
    const match = REACTION_EMOJIS.find((e) => e.type === r.type);
    const emoji = match?.emoji || "❤️";
    if (!groups[r.type]) {
      groups[r.type] = { emoji, count: 0, types: [r.type] };
    }
    groups[r.type].count++;
  }
  return Object.values(groups);
}

// ═══════════════════════════════════════════════════════════
// Interfaces
// ═══════════════════════════════════════════════════════════
interface Comment {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  parent_id?: string | null;
  author: {
    id: string;
    display_name: string;
    username: string;
    avatar_url?: string | null;
    neighborhood?: string | null;
  };
  reactions: { user_id: string; type: string }[];
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
    avatar_url?: string | null;
    neighborhood?: string | null;
  };
  reactions: { user_id: string; type: string }[];
}

// ═══════════════════════════════════════════════════════════
// FeedView
// ═══════════════════════════════════════════════════════════
export function FeedView() {
  const { profile, setViewingUser } = useStore();
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
          prev.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  reactions: data.reacted
                    ? [...p.reactions, { user_id: profile.id, type }]
                    : p.reactions.filter((r) => !(r.user_id === profile.id && r.type === type)),
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
      {/* Composer */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-start gap-3">
          <UserAvatar user={{ id: profile?.id || "", display_name: profile?.display_name || "?", avatar_url: profile?.avatar_url }} className="h-9 w-9 shrink-0" />
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

      {/* Posts */}
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
          onDelete={handleDelete}
          onUpdateCommentCount={updateCommentCount}
          openUserProfile={setViewingUser}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PostThread — Post com thread de comentários expansível
// ═══════════════════════════════════════════════════════════
function PostThread({
  post,
  profile,
  onReaction,
  onDelete,
  onUpdateCommentCount,
  openUserProfile,
}: {
  post: PostWithAuthor;
  profile: Profile | null;
  onReaction: (postId: string, type: string) => void;
  onDelete: (postId: string) => void;
  onUpdateCommentCount: (postId: string, delta: number) => void;
  openUserProfile: (userId: string) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const reactionGroups = buildReactionGroups(post.reactions || []);
  const commentCount = post.comment_count || 0;

  const fetchComments = async () => {
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`);
      const data = await res.json();
      if (data.comments) setComments(data.comments);
    } catch { /* silent */ }
    setCommentsLoading(false);
  };

  const toggleComments = () => {
    if (!showComments && comments.length === 0) {
      fetchComments();
    }
    setShowComments(!showComments);
  };

  const openAndFocus = () => {
    if (!showComments) {
      if (comments.length === 0) fetchComments();
      setShowComments(true);
    }
    setTimeout(() => commentInputRef.current?.focus(), 100);
  };

  const handleReply = (comment: Comment) => {
    setReplyTo(comment);
    if (!showComments) {
      if (comments.length === 0) fetchComments();
      setShowComments(true);
    }
    setTimeout(() => commentInputRef.current?.focus(), 100);
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
        setComments((prev) => [...prev, data.comment]);
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
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        onUpdateCommentCount(post.id, -1);
      }
    } catch { toast.error("Erro ao excluir comentário"); }
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
        setComments((prev) =>
          prev.map((c) => {
            if (c.id !== commentId) return c;
            const reactions = data.reacted
              ? [...(c.reactions || []), { user_id: profile.id, type }]
              : (c.reactions || []).filter((r: any) => !(r.user_id === profile.id && r.type === type));
            return { ...c, reactions };
          })
        );
      }
    } catch { /* silent */ }
  };

  const buildCommentTree = (flatComments: Comment[]) => {
    const map = new Map<string, Comment[]>();
    const roots: Comment[] = [];
    for (const c of flatComments) {
      if (c.parent_id) {
        const children = map.get(c.parent_id) || [];
        children.push(c);
        map.set(c.parent_id, children);
      } else {
        roots.push(c);
      }
    }
    return { roots, map };
  };

  const { roots: commentRoots, map: commentMap } = buildCommentTree(comments);

  return (
    <div className="rounded-xl border bg-card">
      {/* Post Content */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <button onClick={() => openUserProfile(post.author.id)} className="shrink-0">
            <UserAvatar user={post.author} className="h-9 w-9 hover:opacity-80 transition-opacity" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => openUserProfile(post.author.id)}
                className="text-sm font-semibold hover:underline underline-offset-2 transition-all"
              >
                {post.author.display_name}
              </button>
              <span className="text-xs text-muted-foreground">@{post.author.username}</span>
              {post.author.neighborhood && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {post.author.neighborhood}
                </Badge>
              )}
            </div>
            <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
            <div className="mt-3 flex items-center gap-3 text-muted-foreground flex-wrap">
              {REACTION_EMOJIS.map(({ type, emoji, label }) => {
                const isActive = post.reactions?.some((r) => r.user_id === profile?.id && r.type === type);
                const count = post.reactions?.filter((r) => r.type === type).length || 0;
                return (
                  <button
                    key={type}
                    onClick={() => onReaction(post.id, type)}
                    className={`flex items-center gap-0.5 text-xs transition-colors ${isActive ? "text-primary font-semibold" : "hover:text-primary"}`}
                    title={label}
                  >
                    <span className="text-sm">{emoji}</span>
                    {count > 0 && <span>{count}</span>}
                  </button>
                );
              })}

              {reactionGroups.length > 0 && (
                <div className="flex gap-1">
                  {reactionGroups.map((g, i) => (
                    <span key={i} className="inline-flex items-center gap-0.5 rounded-full border bg-muted/50 px-1.5 py-0.5 text-[10px]">
                      {g.emoji} {g.count}
                    </span>
                  ))}
                </div>
              )}

              <button
                onClick={openAndFocus}
                className="flex items-center gap-1.5 text-xs transition-colors hover:text-primary"
              >
                <MessageCircle className="h-4 w-4" />
                {commentCount > 0 && commentCount}
              </button>

              <span className="text-xs">{timeAgo(post.created_at)}</span>

              {post.author_id === profile?.id && (
                <button
                  onClick={() => onDelete(post.id)}
                  className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toggle Comments */}
      {(commentCount > 0 || comments.length > 0) && (
        <button
          onClick={toggleComments}
          className="flex w-full items-center justify-center gap-1.5 border-t py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
        >
          {showComments ? (
            <>Ocultar comentários <ChevronUp className="h-3 w-3" /></>
          ) : (
            <>{commentCount || comments.length} comentário{(commentCount || comments.length) !== 1 ? "s" : ""} <ChevronDown className="h-3 w-3" }</>
          )}
        </button>
      )}

      {/* Comments Thread */}
      {showComments && (
        <div className="border-t bg-muted/20">
          <div className="max-h-64 overflow-y-auto px-4 py-3">
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
                {commentRoots.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    replies={commentMap.get(comment.id) || []}
                    profile={profile}
                    commentMap={commentMap}
                    onDelete={deleteComment}
                    onReply={handleReply}
                    onReaction={handleCommentReaction}
                    openUserProfile={openUserProfile}
                    depth={0}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Comment Input */}
          {profile && (
            <div className="border-t px-4 py-2.5">
              {replyTo && (
                <div className="flex items-center gap-1.5 mb-1.5 text-xs text-muted-foreground">
                  <Reply className="h-3 w-3" />
                  <span>Respondendo a <strong>@{replyTo.author.display_name}</strong></span>
                  <button onClick={() => setReplyTo(null)} className="text-destructive hover:underline ml-1">Cancelar</button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <UserAvatar user={{ id: profile.id, display_name: profile.display_name, avatar_url: profile.avatar_url }} className="h-6 w-6 shrink-0" />
                <Input
                  ref={commentInputRef}
                  placeholder={replyTo ? `Responder @${replyTo.author.display_name}...` : "Escreva um comentário..."}
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value.slice(0, 300))}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submitComment()}
                  className="h-8 text-xs border-0 bg-muted/50 focus-visible:ring-1"
                />
                <Button
                  size="icon"
                  onClick={submitComment}
                  disabled={!commentInput.trim() || submitting}
                  className="h-8 w-8 shrink-0 rounded-full"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick comment input (when thread is closed) */}
      {!showComments && profile && (
        <div className="flex items-center gap-2 border-t px-4 py-2.5">
          <UserAvatar user={{ id: profile.id, display_name: profile.display_name, avatar_url: profile.avatar_url }} className="h-6 w-6 shrink-0" />
          <Input
            placeholder="Escreva um comentário..."
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value.slice(0, 300))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                if (commentInput.trim()) {
                  openAndFocus();
                }
              }
            }}
            onFocus={openAndFocus}
            className="h-8 text-xs border-0 bg-muted/50 focus-visible:ring-1"
          />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CommentItem — Comentário com replies aninhados
// ═══════════════════════════════════════════════════════════
function CommentItem({
  comment,
  replies,
  profile,
  commentMap,
  onDelete,
  onReply,
  onReaction,
  openUserProfile,
  depth,
}: {
  comment: Comment;
  replies: Comment[];
  profile: Profile | null;
  commentMap: Map<string, Comment[]>;
  onDelete: (commentId: string) => void;
  onReply: (comment: Comment) => void;
  onReaction: (commentId: string, type: string) => void;
  openUserProfile: (userId: string) => void;
  depth: number;
}) {
  const commentReactionGroups = buildReactionGroups(comment.reactions || []);

  return (
    <div className={depth > 0 ? "ml-6 border-l-2 border-muted pl-3" : ""}>
      <div className="flex gap-2.5">
        <button onClick={() => openUserProfile(comment.author.id)} className="shrink-0">
          <UserAvatar user={comment.author} className="h-6 w-6 hover:opacity-80 transition-opacity" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => openUserProfile(comment.author.id)}
              className="text-xs font-semibold hover:underline underline-offset-2 transition-all"
            >
              {comment.author.display_name}
            </button>
            <span className="text-[10px] text-muted-foreground">{timeAgo(comment.created_at)}</span>
          </div>
          <p className="text-xs leading-relaxed">{comment.content}</p>

          <div className="mt-1 flex items-center gap-2 flex-wrap">
            {REACTION_EMOJIS.slice(0, 4).map(({ type, emoji }) => {
              const isActive = comment.reactions?.some((r) => r.user_id === profile?.id && r.type === type);
              const count = comment.reactions?.filter((r) => r.type === type).length || 0;
              if (count === 0 && !isActive) return null;
              return (
                <button
                  key={type}
                  onClick={() => onReaction(comment.id, type)}
                  className={`text-[10px] transition-colors ${isActive ? "text-primary font-semibold" : "hover:text-primary"}`}
                >
                  {emoji}{count > 0 && ` ${count}`}
                </button>
              );
            })}
            <button
              onClick={() => onReply(comment)}
              className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
            >
              <Reply className="h-2.5 w-2.5 inline" /> Responder
            </button>
            {comment.author_id === profile?.id && (
              <button
                onClick={() => onDelete(comment.id)}
                className="text-[10px] text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {replies.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          replies={commentMap.get(reply.id) || []}
          profile={profile}
          commentMap={commentMap}
          onDelete={onDelete}
          onReply={onReply}
          onReaction={onReaction}
          openUserProfile={openUserProfile}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// FeedSkeleton
// ═══════════════════════════════════════════════════════════
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
