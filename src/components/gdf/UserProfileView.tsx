"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  UserPlus,
  UserMinus,
  MessageCircle,
  MapPin,
  Calendar,
  Users,
  Heart,
  Loader2,
} from "lucide-react";
import { UserAvatar } from "./UserAvatar";
import { timeAgo } from "@/lib/constants";
import { toast } from "sonner";

export function UserProfileView() {
  const { profile, viewingUserId, setViewingUser, setTab, setSelectedDM } = useStore();
  const [userData, setUserData] = useState<any>(null);
  const [followData, setFollowData] = useState<{
    followingCount: number;
    followersCount: number;
    isFollowing: boolean;
  }>({ followingCount: 0, followersCount: 0, isFollowing: false });
  const [postCount, setPostCount] = useState(0);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "followers" | "following">("posts");
  const [followList, setFollowList] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [myFollowingIds, setMyFollowingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!viewingUserId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [profileRes, followRes, postsRes] = await Promise.all([
          fetch(`/api/users/${viewingUserId}`),
          fetch(`/api/follows?userId=${viewingUserId}`),
          fetch(`/api/users/${viewingUserId}/posts`),
        ]);

        const profileData = await profileRes.json();
        if (profileData.user) {
          setUserData(profileData.user);
          setPostCount(profileData.user._count?.posts || 0);
        }

        const fData = await followRes.json();
        if (!fData.error) {
          setFollowData({
            followingCount: fData.followingCount || 0,
            followersCount: fData.followersCount || 0,
            isFollowing: fData.isFollowing || false,
          });
        }

        const pData = await postsRes.json();
        if (pData.posts) setUserPosts(pData.posts);
      } catch {
        // silent
      }
      setLoading(false);
    };

    fetchData();
  }, [viewingUserId]);

  useEffect(() => {
    if (!viewingUserId || activeTab === "posts") return;

    const fetchList = async () => {
      setListLoading(true);
      try {
        const res = await fetch(`/api/follows?userId=${viewingUserId}`);
        const data = await res.json();
        if (data.error) {
          setFollowList([]);
        } else {
          const list =
            activeTab === "followers"
              ? (data.followers || []).map((f: any) => f.follower).filter(Boolean)
              : (data.following || []).map((f: any) => f.following).filter(Boolean);
          setFollowList(list);
        }

        if (profile && profile.id !== viewingUserId) {
          const myFollowsRes = await fetch(`/api/follows?userId=${profile.id}`);
          const myFollowsData = await myFollowsRes.json();
          if (!myFollowsData.error && myFollowsData.following) {
            const ids = new Set<string>(myFollowsData.following.map((f: any) => f.following?.id).filter(Boolean) as string[]);
            setMyFollowingIds(ids);
          }
        }
      } catch {
        setFollowList([]);
      }
      setListLoading(false);
    };

    fetchList();
  }, [viewingUserId, activeTab, profile]);

  const handleFollowToggle = async (targetId?: string) => {
    const idToFollow = targetId || viewingUserId;
    if (!profile || profile.id === idToFollow || followLoading) return;

    if (!targetId) setFollowLoading(true);
    try {
      const res = await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: idToFollow }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        const nowFollowing = data.following;
        if (!targetId) {
          setFollowData((prev) => ({
            ...prev,
            isFollowing: nowFollowing,
            followersCount: prev.followersCount + (nowFollowing ? 1 : -1),
          }));
        }
        setMyFollowingIds((prev) => {
          const next = new Set(prev);
          if (nowFollowing && idToFollow) next.add(idToFollow);
          else if (idToFollow) next.delete(idToFollow);
          return next;
        });
        toast.success(nowFollowing ? "Seguindo!" : "Deixou de seguir");
      }
    } catch {
      toast.error("Erro ao seguir");
    }
    if (!targetId) setFollowLoading(false);
  };

  const handleStartDM = async () => {
    if (!profile || !viewingUserId) return;
    try {
      const res = await fetch("/api/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: viewingUserId }),
      });
      const data = await res.json();
      if (data.conversation) {
        setViewingUser(null);
        setSelectedDM(data.conversation);
        setTab("dms");
      }
    } catch {
      toast.error("Erro ao iniciar conversa");
    }
  };

  const goBack = () => {
    setViewingUser(null);
  };

  if (!viewingUserId) return null;

  const isOwnProfile = profile?.id === viewingUserId;

  return (
    <div className="space-y-4">
      {/* Header com botão voltar */}
      <div className="flex items-center gap-3">
        <button
          onClick={goBack}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold truncate">
            {userData?.display_name || "..."}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {postCount} {postCount === 1 ? "post" : "posts"}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="h-28 rounded-xl bg-muted/50 animate-pulse" />
          <div className="flex items-center gap-4 px-2">
            <div className="h-20 w-20 rounded-full bg-muted animate-pulse" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-32 rounded bg-muted animate-pulse" />
              <div className="h-3 w-24 rounded bg-muted animate-pulse" />
            </div>
          </div>
        </div>
      ) : userData ? (
        <>
          {/* Banner */}
          <div className="h-24 rounded-xl bg-gradient-to-br from-primary/40 via-primary/20 to-primary/5" />

          {/* Avatar + Info */}
          <div className="-mt-10 px-1">
            <div className="flex items-end justify-between mb-3">
              <UserAvatar
                user={{
                  id: viewingUserId,
                  display_name: userData.display_name,
                  avatar_url: userData.avatar_url,
                }}
                className="h-18 w-18 border-4 border-background shadow-lg"
              />
              {!isOwnProfile && (
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartDM}
                    className="gap-1.5 rounded-full px-3"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Mensagem</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleFollowToggle()}
                    disabled={followLoading}
                    variant={followData.isFollowing ? "outline" : "default"}
                    className="gap-1.5 rounded-full px-5 min-w-[100px]"
                  >
                    {followLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : followData.isFollowing ? (
                      <>
                        <UserMinus className="h-3.5 w-3.5" />
                        Seguindo
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

            {/* Nome e username */}
            <h2 className="text-xl font-bold leading-tight">
              {userData.display_name}
            </h2>
            <p className="text-sm text-muted-foreground">
              @{userData.username}
            </p>

            {/* Bairro */}
            {userData.neighborhood && (
              <Badge variant="secondary" className="mt-2 gap-1">
                <MapPin className="h-3 w-3" /> {userData.neighborhood}
              </Badge>
            )}

            {/* Bio */}
            {userData.bio ? (
              <p className="mt-3 text-sm leading-relaxed">{userData.bio}</p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground italic">
                Sem bio ainda
              </p>
            )}

            {/* Data de entrada */}
            <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Entrou em{" "}
              {new Date(userData.created_at).toLocaleDateString("pt-BR", {
                month: "long",
                year: "numeric",
              })}
            </div>

            {/* Stats */}
            <div className="mt-4 flex gap-6">
              <button
                onClick={() => setActiveTab("posts")}
                className="text-left hover:opacity-80 transition-opacity"
              >
                <p className="text-lg font-bold">{postCount}</p>
                <p className="text-[11px] text-muted-foreground">Posts</p>
              </button>
              <button
                onClick={() => setActiveTab("following")}
                className="text-left hover:opacity-80 transition-opacity"
              >
                <p className="text-lg font-bold">
                  {followData.followingCount}
                </p>
                <p className="text-[11px] text-muted-foreground">Seguindo</p>
              </button>
              <button
                onClick={() => setActiveTab("followers")}
                className="text-left hover:opacity-80 transition-opacity"
              >
                <p className="text-lg font-bold">
                  {followData.followersCount}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Seguidores
                </p>
              </button>
            </div>
          </div>

          {/* Tab Bar */}
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab("posts")}
              className={`flex-1 flex items-center justify-center gap-1.5 pb-3 text-xs font-semibold transition-colors ${
                activeTab === "posts"
                  ? "text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Heart className="h-3.5 w-3.5" />
              Posts
            </button>
            <button
              onClick={() => setActiveTab("followers")}
              className={`flex-1 flex items-center justify-center gap-1.5 pb-3 text-xs font-semibold transition-colors ${
                activeTab === "followers"
                  ? "text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Seguidores
            </button>
            <button
              onClick={() => setActiveTab("following")}
              className={`flex-1 flex items-center justify-center gap-1.5 pb-3 text-xs font-semibold transition-colors ${
                activeTab === "following"
                  ? "text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Seguindo
            </button>
          </div>

          {/* Tab Content */}
          <div>
            {activeTab === "posts" && (
              <div>
                {userPosts.length === 0 ? (
                  <div className="py-12 text-center">
                    <Heart className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Nenhum post ainda
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Quando este usuário publicar, os posts aparecerão aqui
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {userPosts.map((post: any) => (
                      <div
                        key={post.id}
                        className="rounded-xl border bg-card p-3.5"
                      >
                        <p className="text-sm leading-relaxed">
                          {post.content}
                        </p>
                        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                          <span>{timeAgo(post.created_at)}</span>
                          {post.neighborhood && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-0.5">
                                <MapPin className="h-2.5 w-2.5" />
                                {post.neighborhood}
                              </span>
                            </>
                          )}
                          {post._count?.comments > 0 && (
                            <>
                              <span>·</span>
                              <span>{post._count.comments} comentários</span>
                            </>
                          )}
                          {post._count?.reactions > 0 && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-0.5">
                                <Heart className="h-2.5 w-2.5" />
                                {post._count.reactions}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(activeTab === "followers" || activeTab === "following") && (
              <div>
                {listLoading ? (
                  <div className="space-y-2 py-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 animate-pulse"
                      >
                        <div className="h-10 w-10 rounded-full bg-muted" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3.5 w-28 rounded bg-muted" />
                          <div className="h-2.5 w-20 rounded bg-muted" />
                        </div>
                        <div className="h-7 w-20 rounded-full bg-muted" />
                      </div>
                    ))}
                  </div>
                ) : followList.length === 0 ? (
                  <div className="py-12 text-center">
                    <Users className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {activeTab === "followers"
                        ? "Nenhum seguidor ainda"
                        : "Não segue ninguém ainda"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {followList.map((u: any) => {
                      const iFollowThem = myFollowingIds.has(u.id);
                      const isMe = profile?.id === u.id;

                      return (
                        <button
                          key={u.id}
                          onClick={() => {
                            if (!isMe) {
                              setViewingUser(u.id);
                            }
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-accent"
                        >
                          <UserAvatar
                            user={{
                              id: u.id,
                              display_name: u.display_name,
                              avatar_url: u.avatar_url,
                            }}
                            className="h-10 w-10"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate">
                              {u.display_name}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              @{u.username}
                            </div>
                            {u.neighborhood && (
                              <div className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5 mt-0.5">
                                <MapPin className="h-2.5 w-2.5" />
                                {u.neighborhood}
                              </div>
                            )}
                          </div>
                          {!isMe && (
                            <Button
                              size="sm"
                              variant={iFollowThem ? "outline" : "default"}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFollowToggle(u.id);
                              }}
                              className="rounded-full px-3 h-7 text-[11px] gap-1 shrink-0"
                            >
                              {iFollowThem ? (
                                "Seguindo"
                              ) : (
                                <>
                                  <UserPlus className="h-3 w-3" />
                                  Seguir
                                </>
                              )}
                            </Button>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="py-12 text-center">
          <Users className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Usuário não encontrado
          </p>
        </div>
      )}
    </div>
  );
}
