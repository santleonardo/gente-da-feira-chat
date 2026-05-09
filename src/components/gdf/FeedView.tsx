"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import type { Profile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Heart, MessageCircle, Trash2, Send, ChevronDown, ChevronUp, Reply } from "lucide-react";
import { getInitials, getAvatarColor, timeAgo } from "@/lib/constants";
import { toast } from "sonner";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  parent_id: string | null;
  author: {
    id: string;
    display_name: string;
    username: string;
    avatar?: string | null;
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
    neighborhood?: string | null;
  };
  reactions: { user_id: string; type: string }[];
}

// Organizar comentários em árvore (pais + respostas)
function buildCommentTree(flatComments: Comment[]): Comment[] {
  const map = new Map<string, Comment>();
  const roots: Comment[] = [];

  // Primeiro, criar o mapa com replies vazios
  for (const c of flatComments) {
    map.set(c.id, { ...c, replies: [] });
  }

  // Depois, organizar em árvore
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
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className={`${getAvatarColor(profile?.id || "")} text-xs text-white`}>
              {getInitials(profile?.display_name || "?")}
            </AvatarFallback>
          </Avatar>
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
          onLike={handleLike}
          onDelete={handleDelete}
          onUpdateCommentCount={updateCommentCount}
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
  onLike,
  onDelete,
  onUpdateCommentCount,
}: {
  post: PostWithAuthor;
  profile: Profile | null;
  onLike: (postId: string) => void;
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

  const liked = post.reactions?.some((r) => r.user_id === profile?.id);
  const likeCount = post.reactions?.length || 0;
  const commentCount = post.comment_count || 0;

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

  const startReply = (commentId: string, authorName: string) => {
    setReplyTo({ id: commentId, name: authorName });
    if (!showComments) {
      if (comments.length === 0) fetchComments();
      setShowComments(true);
    }
    setTimeout(() => commentInputRef.current?.focus(), 100);
  };

  const cancelReply = () => {
    setReplyTo(null);
  };

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
            .map((c) => ({
              ...c,
              replies: c.replies ? removeRecursive(c.replies) : [],
            }));
        setComments((prev) => removeRecursive(prev));
        onUpdateCommentCount(post.id, -1);
      }
    } catch { toast.error("Erro ao excluir comentário"); }
  };

  return (
    <div className="rounded-xl border bg-card">
      {/* Post Content */}
      <div className="p-4">
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
            <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
            <div className="mt-3 flex items-center gap-4 text-muted-foreground">
              <button
                onClick={() => onLike(post.id)}
                className="flex items-center gap-1.5 text-xs transition-colors hover:text-rose-500"
              >
                <Heart className={`h-4 w-4 ${liked ? "fill-rose-500 text-rose-500" : ""}`} />
                {likeCount > 0 && likeCount}
              </button>
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
            <>{commentCount || comments.length} comentário{(commentCount || comments.length) !== 1 ? "s" : ""} <ChevronDown className="h-3 w-3" /></>
          )}
        </button>
      )}

      {/* Comments Thread */}
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
                <div className="flex items-center gap-2 mb-1.5">
                  <Reply className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">
                    Respondendo a <strong>@{replyTo.name}</strong>
                  </span>
                  <button
                    onClick={cancelReply}
                    className="text-[10px] text-muted-foreground hover:text-destructive ml-1"
                  >
                    Cancelar
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarFallback className={`${getAvatarColor(profile.id)} text-[8px] text-white`}>
                    {getInitials(profile.display_name)}
                  </AvatarFallback>
                </Avatar>
                <Input
                  ref={commentInputRef}
                  placeholder={replyTo ? `Responder @${replyTo.name}...` : "Escreva um comentário..."}
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
          <Avatar className="h-6 w-6 shrink-0">
            <AvatarFallback className={`${getAvatarColor(profile.id)} text-[8px] text-white`}>
              {getInitials(profile.display_name)}
            </AvatarFallback>
          </Avatar>
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
}

// ═══════════════════════════════════════════════════════════
// CommentItem — Comentário individual com respostas aninhadas
// ═══════════════════════════════════════════════════════════
function CommentItem({
  comment,
  profile,
  onDelete,
  onReply,
  depth,
}: {
  comment: Comment;
  profile: Profile | null;
  onDelete: (commentId: string) => void;
  onReply: (commentId: string, authorName: string) => void;
  depth: number;
}) {
  const maxDepth = 1;
  const indent = depth > 0 ? "ml-6 border-l-2 border-muted pl-3" : "";

  return (
    <div>
      <div className={`flex gap-2.5 ${indent}`}>
        <Avatar className="h-6 w-6 shrink-0">
          <AvatarFallback className={`${getAvatarColor(comment.author.id)} text-[8px] text-white`}>
            {getInitials(comment.author.display_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold">{comment.author.display_name}</span>
            <span className="text-[10px] text-muted-foreground">{timeAgo(comment.created_at)}</span>
          </div>
          <p className="text-xs leading-relaxed">{comment.content}</p>
          <div className="flex items-center gap-3 mt-1">
            {depth < maxDepth && profile && (
              <button
                onClick={() => onReply(comment.id, comment.author.display_name)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
              >
                <Reply className="h-2.5 w-2.5" />
                Responder
              </button>
            )}
            {comment.author_id === profile?.id && (
              <button
                onClick={() => onDelete(comment.id)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-2.5 w-2.5" />
                Excluir
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Respostas aninhadas */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              profile={profile}
              onDelete={onDelete}
              onReply={onReply}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
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
