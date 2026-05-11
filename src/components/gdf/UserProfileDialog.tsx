"use client";

import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  X,
  UserPlus,
  UserMinus,
  MessageCircle,
  Users,
  Grid3X3,
  Heart,
  Play,
} from "lucide-react";
import { UserAvatar } from "./UserAvatar";
import { timeAgo } from "@/lib/constants";
import { toast } from "sonner";

// ── Color palette for text post cards ──
const POST_COLORS = [
  "bg-amber-100 dark:bg-amber-900/30",
  "bg-rose-100 dark:bg-rose-900/30",
  "bg-sky-100 dark:bg-sky-900/30",
  "bg-emerald-100 dark:bg-emerald-900/30",
  "bg-violet-100 dark:bg-violet-900/30",
  "bg-orange-100 dark:bg-orange-900/30",
  "bg-pink-100 dark:bg-pink-900/30",
  "bg-teal-100 dark:bg-teal-900/30",
  "bg-slate-200 dark:bg-slate-700/40",
  "bg-indigo-100 dark:bg-indigo-900/30",
];

function getPostColor(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++)
    hash = content.charCodeAt(i) + ((hash << 5) - hash);
  return POST_COLORS[Math.abs(hash) % POST_COLORS.length];
}

// ── Types ──
interface UserProfileDialogProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type MasonryItem =
  | { type: "photo"; id: string; url: string; reactions: { user_id: string; type: string }[]; comment_count: number; created_at: string }
  | { type: "text"; id: string; content: string; reactions: { user_id: string; type: string }[]; created_at: string }
  | { type: "video"; id: string; url: string; thumbnail_url: string; duration: number; created_at: string };

// ═══════════════════════════════════════════════════════════
// UserProfileDialog — Full-screen public profile
// Uma única aba "Posts" com fotos + vídeos + posts de texto
// ═══════════════════════════════════════════════════════════
export function UserProfileDialog({ userId, open, onOpenChange }: UserProfileDialogProps) {
  const { profile } = useStore();
  const [userData, setUserData] = useState<any>(null);
  const [followInfo, setFollowInfo] = useState<{
    followingCount: number;
    followersCount: number;
    isFollowing: boolean;
  }>({ followingCount: 0, followersCount: 0, isFollowing: false });
  const [postCount, setPostCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "seguidores" | "seguindo">("posts");
  const [followList, setFollowList] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);

  // Masonry data — all items (photos + videos + text posts)
  const [masonryItems, setMasonryItems] = useState<MasonryItem[]>([]);

  // Video modal
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);

  const isOwnProfile = profile?.id === userId;

  // ── Fetch user data ──
  useEffect(() => {
    if (!userId || !open) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const profileRes = await fetch(`/api/users/${userId}`);
        const profileData = await profileRes.json();
        if (profileData.user) {
          setUserData(profileData.user);
          setPostCount(profileData.user._count?.posts || 0);
        }

        const followRes = await fetch(`/api/follows?userId=${userId}`);
        const followResData = await followRes.json();
        if (!followRes.ok && followResData.error) {
          setFollowInfo({ followingCount: 0, followersCount: 0, isFollowing: false });
        } else {
          setFollowInfo({
            followingCount: followResData.followingCount || 0,
            followersCount: followResData.followersCount || 0,
            isFollowing: followResData.isFollowing || false,
          });
        }
      } catch {
        // silent
      }
      setLoading(false);
    };

    fetchData();
  }, [userId, open]);

  // ── Fetch masonry items (photos + posts + videos) ──
  useEffect(() => {
    if (!userId || !open) return;

    const fetchMasonry = async () => {
      try {
        const [photosRes, postsRes, videosRes] = await Promise.all([
          fetch(`/api/profile-photos?userId=${userId}`),
          fetch(`/api/users/${userId}/posts`),
          fetch(`/api/profile-videos?userId=${userId}`),
        ]);

        const photosData = await photosRes.json();
        const postsData = await postsRes.json();
        const videosData = await videosRes.json();

        const items: MasonryItem[] = [];

        // Add photos from gallery
        for (const p of photosData.photos || []) {
          items.push({
            type: "photo",
            id: p.id,
            url: p.url,
            reactions: p.reactions || [],
            comment_count: p.comment_count || 0,
            created_at: p.created_at,
          });
        }

        // Add feed posts — text-only AND posts with images
        for (const p of postsData.posts || []) {
          if (!p.image_url) {
            items.push({
              type: "text",
              id: p.id,
              content: p.content,
              reactions: p.reactions || [],
              created_at: p.created_at,
            });
          } else {
            // Posts with images show as photo cards
            items.push({
              type: "photo",
              id: p.id,
              url: p.image_url,
              reactions: p.reactions || [],
              comment_count: 0,
              created_at: p.created_at,
            });
          }
        }

        // Add videos
        for (const v of videosData.videos || []) {
          items.push({
            type: "video",
            id: v.id,
            url: v.url,
            thumbnail_url: v.thumbnail_url || "",
            duration: v.duration || 0,
            created_at: v.created_at,
          });
        }

        // Sort by created_at descending (most recent first)
        items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setMasonryItems(items);
      } catch {
        // silent
      }
    };

    fetchMasonry();
  }, [userId, open]);

  // ── Fetch follow list ──
  useEffect(() => {
    if (!userId || !open || (activeTab !== "seguidores" && activeTab !== "seguindo")) return;

    const fetchList = async () => {
      setListLoading(true);
      try {
        const res = await fetch(`/api/follows?userId=${userId}`);
        const data = await res.json();
        if (data.error) {
          setFollowList([]);
        } else {
          const list =
            activeTab === "seguidores"
              ? (data.followers || []).map((f: any) => f.follower).filter(Boolean)
              : (data.following || []).map((f: any) => f.following).filter(Boolean);
          setFollowList(list);
        }
      } catch {
        setFollowList([]);
      }
      setListLoading(false);
    };

    fetchList();
  }, [userId, open, activeTab]);

  // ── Handlers ──
  const handleFollowToggle = async () => {
    if (!userId || !profile || profile.id === userId || followLoading) return;
    setFollowLoading(true);
    try {
      const res = await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: userId }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        const nowFollowing = data.following;
        setFollowInfo((prev) => ({
          ...prev,
          isFollowing: nowFollowing,
          followersCount: prev.followersCount + (nowFollowing ? 1 : -1),
        }));
        toast.success(nowFollowing ? "Seguindo!" : "Deixou de seguir");
      }
    } catch {
      toast.error("Erro ao seguir");
    }
    setFollowLoading(false);
  };

  const handleStartDM = async () => {
    if (!profile || !userId) return;
    try {
      const res = await fetch("/api/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: userId }),
      });
      const data = await res.json();
      if (data.conversation) {
        useStore.getState().setSelectedDM(data.conversation);
        useStore.getState().setTab("dms");
        onOpenChange(false);
      }
    } catch {
      toast.error("Erro ao iniciar conversa");
    }
  };

  const navigateToProfile = useCallback(
    (uid: string) => {
      onOpenChange(false);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("openUserProfile", { detail: { userId: uid } }));
      }, 200);
    },
    [onOpenChange]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      {/* ── Close Button ── */}
      <button
        onClick={() => onOpenChange(false)}
        className="fixed top-4 right-4 z-[60] flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition-colors"
      >
        <X className="h-5 w-5" />
      </button>

      {loading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-primary animate-pulse" />
            <p className="text-sm text-muted-foreground">Carregando perfil...</p>
          </div>
        </div>
      ) : userData ? (
        <>
          {/* ════════════════════════════════════════════
              HEADER — Gradient + Avatar + Info
              ════════════════════════════════════════════ */}
          <div className="relative">
            {/* Gradient Banner */}
            <div className="h-40 sm:h-48 bg-gradient-to-br from-primary via-primary/70 to-primary/30" />

            {/* Avatar + Info overlay */}
            <div className="max-w-2xl mx-auto px-4 -mt-12">
              <div className="flex items-end gap-4">
                {/* Rounded-square avatar 80x80 */}
                <UserAvatar
                  user={{ id: userId!, display_name: userData.display_name, avatar_url: userData.avatar_url }}
                  className="h-20 w-20 rounded-2xl border-4 border-background shadow-lg flex-shrink-0"
                />
                <div className="flex-1 pb-1" />
                {/* Action buttons for other users */}
                {!isOwnProfile && (
                  <div className="flex gap-2 pb-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStartDM}
                      className="gap-1.5 rounded-full px-3 bg-background/80 backdrop-blur-sm"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleFollowToggle}
                      disabled={followLoading}
                      variant={followInfo.isFollowing ? "outline" : "default"}
                      className="gap-1.5 rounded-full px-4"
                    >
                      {followInfo.isFollowing ? (
                        <>
                          <UserMinus className="h-3.5 w-3.5" />
                          Deixar de seguir
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-3.5 w-3.5" />
                          Seguir
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Name + username + bio */}
              <div className="mt-2">
                <h2 className="text-xl font-bold leading-tight">{userData.display_name}</h2>
                <p className="text-sm text-muted-foreground">@{userData.username}</p>

                {userData.bio ? (
                  <p className="mt-2 text-sm leading-relaxed">{userData.bio}</p>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground italic">Sem bio ainda</p>
                )}
              </div>

              {/* Stats row */}
              <div className="mt-4 flex gap-6">
                <div className="text-center">
                  <p className="text-lg font-bold">{postCount}</p>
                  <p className="text-[11px] text-muted-foreground">Posts</p>
                </div>
                <button
                  onClick={() => setActiveTab("seguindo")}
                  className="text-center hover:opacity-80 transition-opacity"
                >
                  <p className="text-lg font-bold">{followInfo.followingCount}</p>
                  <p className="text-[11px] text-muted-foreground">Seguindo</p>
                </button>
                <button
                  onClick={() => setActiveTab("seguidores")}
                  className="text-center hover:opacity-80 transition-opacity"
                >
                  <p className="text-lg font-bold">{followInfo.followersCount}</p>
                  <p className="text-[11px] text-muted-foreground">Seguidores</p>
                </button>
              </div>
            </div>
          </div>

          {/* ════════════════════════════════════════════
              TABS — Posts / Seguidores / Seguindo
              ════════════════════════════════════════════ */}
          <div className="max-w-2xl mx-auto px-4 mt-6">
            <div className="flex border-b">
              <button
                onClick={() => setActiveTab("posts")}
                className={`flex-1 pb-2.5 text-xs font-semibold text-center transition-colors flex items-center justify-center gap-1 ${
                  activeTab === "posts"
                    ? "text-foreground border-b-2 border-primary"
                    : "text-muted-foreground"
                }`}
              >
                <Grid3X3 className="h-3.5 w-3.5" />
                Posts
              </button>
              <button
                onClick={() => setActiveTab("seguidores")}
                className={`flex-1 pb-2.5 text-xs font-semibold text-center transition-colors ${
                  activeTab === "seguidores"
                    ? "text-foreground border-b-2 border-primary"
                    : "text-muted-foreground"
                }`}
              >
                Seguidores
              </button>
              <button
                onClick={() => setActiveTab("seguindo")}
                className={`flex-1 pb-2.5 text-xs font-semibold text-center transition-colors ${
                  activeTab === "seguindo"
                    ? "text-foreground border-b-2 border-primary"
                    : "text-muted-foreground"
                }`}
              >
                Seguindo
              </button>
            </div>
          </div>

          {/* ════════════════════════════════════════════
              TAB CONTENT
              ════════════════════════════════════════════ */}
          <div className="max-w-2xl mx-auto px-4 py-4 pb-24">
            {/* ── Posts Tab: Fotos + Vídeos + Text Posts (all together) ── */}
            {activeTab === "posts" && (
              <>
                {masonryItems.length === 0 ? (
                  <div className="py-12 text-center">
                    <Grid3X3 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhum post ainda</p>
                  </div>
                ) : (
                  <div className="columns-2 gap-2">
                    {masonryItems.map((item) => {
                      // ── Photo card ──
                      if (item.type === "photo") {
                        return (
                          <div key={`photo-${item.id}`} className="break-inside-avoid mb-2">
                            <div className="relative overflow-hidden rounded-lg group">
                              <img
                                src={item.url}
                                alt="Foto"
                                className="w-full max-h-72 object-cover group-hover:opacity-90 transition-opacity"
                                loading="lazy"
                              />
                              {(item.reactions?.length > 0 || item.comment_count > 0) && (
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                                  {item.reactions?.length > 0 && (
                                    <span className="text-white text-xs flex items-center gap-0.5">
                                      ❤️ {item.reactions.length}
                                    </span>
                                  )}
                                  {item.comment_count > 0 && (
                                    <span className="text-white text-xs flex items-center gap-0.5">
                                      💬 {item.comment_count}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // ── Video card ──
                      if (item.type === "video") {
                        return (
                          <div key={`video-${item.id}`} className="break-inside-avoid mb-2">
                            <button
                              onClick={() => setVideoModalUrl(item.url)}
                              className="relative overflow-hidden rounded-lg w-full group"
                            >
                              {item.thumbnail_url ? (
                                <img
                                  src={item.thumbnail_url}
                                  alt="Vídeo"
                                  className="w-full max-h-72 object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-40 bg-muted flex items-center justify-center">
                                  <Play className="h-8 w-8 text-muted-foreground" />
                                </div>
                              )}
                              {/* Play icon overlay */}
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                                <div className="h-12 w-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                                  <Play className="h-5 w-5 text-foreground ml-0.5" fill="currentColor" />
                                </div>
                              </div>
                              {/* Duration badge */}
                              {item.duration > 0 && (
                                <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                                  {Math.floor(item.duration / 60)}:{String(Math.floor(item.duration % 60)).padStart(2, "0")}
                                </span>
                              )}
                            </button>
                          </div>
                        );
                      }

                      // ── Text post card (colored background) ──
                      if (item.type === "text") {
                        return (
                          <div key={`text-${item.id}`} className="break-inside-avoid mb-2">
                            <div
                              className={`rounded-lg p-3 ${getPostColor(item.content)}`}
                            >
                              <p className="text-sm leading-relaxed whitespace-pre-wrap line-clamp-6">
                                {item.content}
                              </p>
                              <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
                                {item.reactions?.length > 0 && (
                                  <span className="flex items-center gap-0.5">
                                    <Heart className="h-3 w-3" /> {item.reactions.length}
                                  </span>
                                )}
                                <span>{timeAgo(item.created_at)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return null;
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── Seguidores / Seguindo ── */}
            {(activeTab === "seguidores" || activeTab === "seguindo") && (
              <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                {listLoading ? (
                  <div className="space-y-2 py-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-2.5 animate-pulse">
                        <div className="h-10 w-10 rounded-full bg-muted" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 w-28 rounded bg-muted" />
                          <div className="h-2.5 w-20 rounded bg-muted" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : followList.length === 0 ? (
                  <div className="py-12 text-center">
                    <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {activeTab === "seguidores" ? "Nenhum seguidor ainda" : "Não segue ninguém ainda"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {followList.map((u: any) => (
                      <button
                        key={u.id}
                        onClick={() => navigateToProfile(u.id)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent"
                      >
                        <UserAvatar
                          user={{ id: u.id, display_name: u.display_name, avatar_url: u.avatar_url }}
                          className="h-10 w-10"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{u.display_name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">@{u.username}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Joined date */}
            <p className="mt-6 text-[11px] text-muted-foreground/60 text-center">
              Entrou em {new Date(userData.created_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </p>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Usuário não encontrado</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => onOpenChange(false)}>
              Voltar
            </Button>
          </div>
        </div>
      )}

      {/* ── Video Player Modal ── */}
      {videoModalUrl && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90"
          onClick={() => setVideoModalUrl(null)}
        >
          <button
            onClick={() => setVideoModalUrl(null)}
            className="absolute top-4 right-4 z-[80] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <video
            src={videoModalUrl}
            controls
            autoPlay
            className="max-h-[90vh] max-w-[95vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
