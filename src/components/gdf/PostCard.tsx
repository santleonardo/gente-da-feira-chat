"use client";

import React, { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Heart, Clock, X } from "lucide-react";
import { timeAgo } from "@/lib/constants";
import { UserAvatar } from "./UserAvatar";
import { renderContentWithMentions, openProfileFromMention } from "@/lib/link-utils";
import { sanitizeHTMLSync, sanitizeHTMLAsync } from "@/lib/sanitize";

// HTML rendering helpers for rich posts
function isHTMLContent(content: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(content);
}

function useDOMPurify() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    sanitizeHTMLAsync("").then(() => setReady(true));
  }, []);
  return ready;
}

function sanitizeHTML(html: string): string {
  return sanitizeHTMLSync(html);
}

function FormattedText({
  content,
  className,
  openUserProfile,
}: {
  content: string;
  className?: string;
  openUserProfile?: (userId: string) => void;
}) {
  if (isHTMLContent(content)) {
    return (
      <div
        className={`post-content ${className || ""}`}
        dangerouslySetInnerHTML={{ __html: sanitizeHTML(content) }}
      />
    );
  }

  // Posts simples com markdown
  const lines = content.split("\n");
  return (
    <div className={className}>
      {lines.map((line, i) => {
        let headingLevel = 0;
        let text = line;
        if (text.startsWith("### ")) { headingLevel = 3; text = text.slice(4); }
        else if (text.startsWith("## ")) { headingLevel = 2; text = text.slice(3); }
        else if (text.startsWith("# ")) { headingLevel = 1; text = text.slice(2); }

        const headingStyle: React.CSSProperties =
          headingLevel > 0
            ? {
                fontSize: headingLevel === 1 ? "1.25rem" : headingLevel === 2 ? "1.1rem" : "1rem",
                fontWeight: 700,
                lineHeight: 1.3,
                display: "block",
                marginTop: i > 0 ? "0.35em" : undefined,
              }
            : {};

        return (
          <React.Fragment key={i}>
            {i > 0 && <br />}
            <span style={headingStyle}>{renderContentWithMentions(text, openUserProfile)}</span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

interface PostCardProps {
  post: {
    id: string;
    content: string;
    created_at: string;
    image_urls?: string[];
    expires_at?: string | null;
    post_type?: "simple" | "rich" | null;
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
  // Inicializa DOMPurify para que sanitizeHTMLSync funcione corretamente
  useDOMPurify();
  const [liked, setLiked] = useState(post.reactions.some((r) => r.user_id === profile?.id));
  const [likeCount, setLikeCount] = useState(post.reactions.length);
  const [loading, setLoading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const openUserProfile = (userId: string) => {
    window.dispatchEvent(new CustomEvent("openUserProfile", { detail: { userId } }));
  };

  const handleLike = async () => {
    if (loading || !profile) return;
    setLoading(true);
    try {
      const res = await fetch("/api/posts/reaction", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: post.id }) });
      const data = await res.json();
      setLiked(data.reacted);
      setLikeCount((c) => (data.reacted ? c + 1 : c - 1));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const hasPhotos = post.image_urls && post.image_urls.length > 0;

  const getExpirationLabel = () => {
    if (!post.expires_at) return null;
    const diff = new Date(post.expires_at).getTime() - Date.now();
    if (diff <= 0) return "Expirado";
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `Expira em ${hours}h`;
    return `Expira em ${mins}min`;
  };

  return (
    <>
      {/* Styles for rendered post content from WYSIWYG editor */}
      <style>{`
        .post-content h1 { font-size: 1.25rem; font-weight: 700; line-height: 1.3; margin: 0.35em 0 0.1em; }
        .post-content h2 { font-size: 1.1rem; font-weight: 700; line-height: 1.3; margin: 0.25em 0 0.1em; }
        .post-content h3 { font-size: 1rem; font-weight: 700; line-height: 1.3; margin: 0.2em 0 0.1em; }
        .post-content h4 { font-size: 0.95rem; font-weight: 600; line-height: 1.3; }
        .post-content b, .post-content strong { font-weight: 700; }
        .post-content i, .post-content em { font-style: italic; }
        .post-content a { color: #0A4D5C; text-decoration: underline; text-underline-offset: 2px; }
        .post-content div { margin: 0; }
      `}</style>
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-start gap-3 mb-3">
          <UserAvatar user={post.author} className="h-10 w-10" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{post.author.display_name}</span>
              {post.author.neighborhood && <span className="text-[10px] px-1.5 py-0 rounded-full bg-secondary text-secondary-foreground">{post.author.neighborhood}</span>}
            </div>
            <p className="text-xs text-muted-foreground">@{post.author.username} · {timeAgo(post.created_at)}</p>
          </div>
        </div>
        <FormattedText className="text-sm leading-relaxed whitespace-pre-wrap mb-3" content={post.content} openUserProfile={openUserProfile} />

        {hasPhotos && (
          <div className="mb-3">
            {post.image_urls!.length === 1 ? (
              <button onClick={() => { setViewerIndex(0); setViewerOpen(true); }} className="w-full overflow-hidden rounded-lg">
                <img src={post.image_urls![0]} alt="Foto do post" className="w-full max-h-64 object-cover" loading="lazy" />
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-1 overflow-hidden rounded-lg">
                {post.image_urls!.slice(0, 4).map((url, i) => (
                  <button key={i} onClick={() => { setViewerIndex(i); setViewerOpen(true); }} className="relative overflow-hidden">
                    <img src={url} alt={`Foto ${i + 1}`} className="w-full h-28 object-cover" loading="lazy" />
                    {i === 3 && post.image_urls!.length > 4 && (<div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white font-bold">+{post.image_urls!.length - 4}</div>)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-4">
          <button onClick={handleLike} className={`flex items-center gap-1.5 text-sm transition-colors ${liked ? "text-rose-500" : "text-muted-foreground hover:text-rose-500"}`}>
            <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>
          {post.expires_at && (<span className="text-[10px] text-amber-500 flex items-center gap-0.5"><Clock className="h-3 w-3" />{getExpirationLabel()}</span>)}
        </div>
      </div>

      {viewerOpen && hasPhotos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={() => setViewerOpen(false)}>
          <button onClick={() => setViewerOpen(false)} className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"><X className="h-5 w-5" /></button>
          {post.image_urls!.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setViewerIndex((i) => (i > 0 ? i - 1 : post.image_urls!.length - 1)); }} className="absolute left-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">‹</button>
              <button onClick={(e) => { e.stopPropagation(); setViewerIndex((i) => (i < post.image_urls!.length - 1 ? i + 1 : 0)); }} className="absolute right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">›</button>
            </>
          )}
          <img src={post.image_urls![viewerIndex]} alt={`Foto ${viewerIndex + 1}`} className="max-h-[90vh] max-w-[95vw] object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
