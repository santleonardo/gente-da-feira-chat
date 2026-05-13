"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { MapPin, UserPlus, UserMinus, MessageCircle, Users, Lock, Loader2, Clock, UserCheck } from "lucide-react";
import { UserAvatar } from "./UserAvatar";
import { timeAgo } from "@/lib/constants";
import { toast } from "sonner";

interface UserProfileDialogProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserProfileDialog({ userId, open, onOpenChange }: UserProfileDialogProps) {
  const { profile } = useStore();
  const [userData, setUserData] = useState<any>(null);
  const [followData, setFollowData] = useState<{
    followingCount: number;
    followersCount: number;
    isFollowing: boolean;
    isPending: boolean;
  }>({ followingCount: 0, followersCount: 0, isFollowing: false, isPending: false });
  const [postCount, setPostCount] = useState(0);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "followers" | "following">("posts");
  const [followList, setFollowList] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);

  // Privacidade
  const [privacyInfo, setPrivacyInfo] = useState<{
    is_private: boolean;
    hide_following: boolean;
    hide_followers: boolean;
    approve_followers: boolean;
    isRestricted: boolean;
  }>({ is_private: false, hide_following: false, hide_followers: false, approve_followers: false, isRestricted: false });

  // Buscar dados do usuário
  useEffect(() => {
    if (!userId || !open) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Buscar perfil
        const profileRes = await fetch(`/api/users/${userId}`);
        const profileData = await profileRes.json();
        if (profileData.user) {
          setUserData(profileData.user);
          setPostCount(profileData.user._count?.posts || 0);

          if (profileData._privacy) {
            setPrivacyInfo(profileData._privacy);
            // Sincronizar isPending vindo do perfil
            if (profileData._privacy.isPending !== undefined) {
              setFollowData((prev) => ({ ...prev, isPending: profileData._privacy.isPending }));
            }
          }
        }

        // Buscar dados de seguidores
        const followRes = await fetch(`/api/follows?userId=${userId}`);
        const followResult = await followRes.json();
        if (!followRes.ok && followResult.error) {
          setFollowData({ followingCount: 0, followersCount: 0, isFollowing: false, isPending: false });
        } else {
          setFollowData({
            followingCount: followResult.followingCount || 0,
            followersCount: followResult.followersCount || 0,
            isFollowing: followResult.isFollowing || false,
            isPending: followResult.isPending || false,
          });

          if (followResult._privacy) {
            setPrivacyInfo((prev) => ({
              ...prev,
              hide_following: followResult._privacy.hide_following,
              hide_followers: followResult._privacy.hide_followers,
              approve_followers: followResult._privacy.approve_followers ?? prev.approve_followers,
              isRestricted: followResult._privacy.isRestricted ?? prev.isRestricted,
            }));
          }
        }

        // Buscar posts
        setPostsLoading(true);
        const postsRes = await fetch(`/api/users/${userId}/posts`);
        const postsData = await postsRes.json();
        if (postsData.posts) {
          setUserPosts(postsData.posts);
        }
        setPostsLoading(false);
      } catch {
        // silent
      }
      setLoading(false);
    };

    fetchData();
  }, [userId, open]);

  // Buscar lista de seguidores/seguindo
  useEffect(() => {
    if (!userId || !open) return;
    if (privacyInfo.isRestricted) return;
    if (activeTab === "posts") return;

    const fetchList = async () => {
      setListLoading(true);
      try {
        const res = await fetch(`/api/follows?userId=${userId}`);
        const data = await res.json();
        if (data.error) {
          setFollowList([]);
        } else {
          let list: any[] = [];
          if (activeTab === "followers") {
            list = (data.followers || []).map((f: any) => f.follower).filter(Boolean);
          } else if (activeTab === "following") {
            list = (data.following || []).map((f: any) => f.following).filter(Boolean);
          }
          setFollowList(list);
        }
      } catch {
        setFollowList([]);
      }
      setListLoading(false);
    };

    fetchList();
  }, [userId, open, activeTab, privacyInfo.isRestricted]);

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
        const nowPending = data.pending;

        if (nowPending) {
          // Solicitação enviada (perfil exige aprovação)
          setFollowData((prev) => ({
            ...prev,
            isPending: true,
          }));
          toast.success("Solicitação enviada!");
        } else if (nowFollowing) {
          // Começou a seguir (sem necessidade de aprovação)
          setFollowData((prev) => ({
            ...prev,
            isFollowing: true,
            isPending: false,
            followersCount: prev.followersCount + 1,
          }));
          toast.success("Seguindo!");

          // Se começou a seguir e o perfil era privado, recarregar dados
          if (privacyInfo.is_private) {
            setPrivacyInfo((prev) => ({ ...prev, isRestricted: false }));
            const profileRes = await fetch(`/api/users/${userId}`);
            const profileData = await profileRes.json();
            if (profileData.user) {
              setUserData(profileData.user);
              setPostCount(profileData.user._count?.posts || 0);
            }
            // Recarregar posts
            const postsRes = await fetch(`/api/users/${userId}/posts`);
            const postsData = await postsRes.json();
            if (postsData.posts) setUserPosts(postsData.posts);
          }
        } else {
          // Deixou de seguir ou cancelou solicitação
          const wasPending = followData.isPending;
          setFollowData((prev) => ({
            ...prev,
            isFollowing: false,
            isPending: false,
            followersCount: wasPending ? prev.followersCount : prev.followersCount - 1,
          }));
          toast.success(wasPending ? "Solicitação cancelada" : "Deixou de seguir");
        }
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

  const isOwnProfile = profile?.id === userId;
  const isRestricted = privacyInfo.isRestricted && !isOwnProfile;
  // Ocultar para TODOS inclusive seguidores — só o dono vê
  const canSeeFollowing = isOwnProfile || !privacyInfo.hide_following;
  const canSeeFollowers = isOwnProfile || !privacyInfo.hide_followers;

  // Determinar quais tabs mostrar
  const visibleTabs: Array<{ id: "posts" | "followers" | "following"; label: string }> = [
    { id: "posts", label: "Posts" },
  ];
  if (canSeeFollowers) visibleTabs.push({ id: "followers", label: "Seguidores" });
  if (canSeeFollowing) visibleTabs.push({ id: "following", label: "Seguindo" });

  // Se a tab ativa não está mais visível, voltar para posts
  useEffect(() => {
    if (activeTab !== "posts" && !visibleTabs.find(t => t.id === activeTab)) {
      setActiveTab("posts");
    }
  }, [canSeeFollowers, canSeeFollowing]);

  // Determinar o texto e ícone do botão de seguir
  const getFollowButton = () => {
    if (followData.isFollowing) {
      return { icon: <UserMinus className="h-3.5 w-3.5" />, label: "Seguindo", variant: "outline" as const };
    }
    if (followData.isPending) {
      return { icon: <Clock className="h-3.5 w-3.5" />, label: "Solicitado", variant: "outline" as const };
    }
    if (privacyInfo.approve_followers) {
      return { icon: <UserCheck className="h-3.5 w-3.5" />, label: "Solicitar", variant: "default" as const };
    }
    return { icon: <UserPlus className="h-3.5 w-3.5" />, label: "Seguir", variant: "default" as const };
  };

  const followBtn = getFollowButton();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-muted animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="h-5 w-32 rounded bg-muted animate-pulse" />
                <div className="h-3 w-24 rounded bg-muted animate-pulse" />
              </div>
            </div>
            <div className="h-4 w-full rounded bg-muted animate-pulse" />
            <div className="flex gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 w-16 rounded bg-muted animate-pulse" />
              ))}
            </div>
          </div>
        ) : userData ? (
          <>
            {/* Header com banner */}
            <div className="h-20 bg-gradient-to-br from-primary/30 via-primary/10 to-transparent" />

            <div className="px-5 pb-5 -mt-8">
              {/* Avatar + Actions */}
              <div className="flex items-end justify-between mb-3">
                <div className="relative">
                  <UserAvatar
                    user={{ id: userId!, display_name: userData.display_name, avatar_url: userData.avatar_url }}
                    className="h-16 w-16 border-4 border-background shadow-lg"
                  />
                  {isRestricted && (
                    <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-muted-foreground">
                      <Lock className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
                {!isOwnProfile && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStartDM}
                      className="gap-1.5 rounded-full px-3"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleFollowToggle}
                      disabled={followLoading}
                      variant={followBtn.variant}
                      className={`gap-1.5 rounded-full px-4 ${
                        followData.isPending ? "border-orange-300 text-orange-600 dark:border-orange-700 dark:text-orange-400" : ""
                      }`}
                    >
                      {followLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          {followBtn.icon}
                          {followBtn.label}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex items-center gap-1.5">
                <h2 className="text-lg font-bold leading-tight">{userData.display_name}</h2>
                {privacyInfo.is_private && (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">@{userData.username}</p>

              {isRestricted ? (
                /* Perfil privado — visão restrita para não-seguidores */
                <div className="mt-4 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/30 p-4 text-center">
                  <Lock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">Este perfil é privado</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Siga este perfil para ver suas publicações e informações
                  </p>
                </div>
              ) : (
                <>
                  {userData.neighborhood && (
                    <Badge variant="secondary" className="mt-2 gap-1">
                      <MapPin className="h-3 w-3" /> {userData.neighborhood}
                    </Badge>
                  )}

                  {userData.bio ? (
                    <p className="mt-3 text-sm leading-relaxed">{userData.bio}</p>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground italic">Sem bio ainda</p>
                  )}
                </>
              )}

              {/* Stats */}
              <div className="mt-4 flex gap-5">
                <div className="text-center">
                  <p className="text-base font-bold">{postCount}</p>
                  <p className="text-[11px] text-muted-foreground">Posts</p>
                </div>
                {canSeeFollowing && (
                  <button
                    onClick={() => setActiveTab("following")}
                    className="text-center hover:opacity-80 transition-opacity"
                  >
                    <p className="text-base font-bold">{followData.followingCount}</p>
                    <p className="text-[11px] text-muted-foreground">Seguindo</p>
                  </button>
                )}
                {canSeeFollowers && (
                  <button
                    onClick={() => setActiveTab("followers")}
                    className="text-center hover:opacity-80 transition-opacity"
                  >
                    <p className="text-base font-bold">{followData.followersCount}</p>
                    <p className="text-[11px] text-muted-foreground">Seguidores</p>
                  </button>
                )}
              </div>

              {/* Tab Bar — só mostra tabs visíveis */}
              {!isRestricted && visibleTabs.length > 1 && (
                <div className="mt-4 flex border-b">
                  {visibleTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 pb-2 text-xs font-semibold text-center transition-colors ${
                        activeTab === tab.id
                          ? "text-foreground border-b-2 border-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Tab Content */}
              {!isRestricted && (
                <div className="max-h-64 overflow-y-auto mt-2 custom-scrollbar">
                  {activeTab === "posts" && (
                    postsLoading ? (
                      <div className="space-y-2 py-2">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
                        ))}
                      </div>
                    ) : userPosts.length === 0 ? (
                      <div className="py-8 text-center">
                        <p className="text-xs text-muted-foreground">Nenhum post ainda</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {userPosts.map((post: any) => (
                          <div key={post.id} className="rounded-lg border bg-card p-3">
                            {post.image_url && (
                              <img
                                src={post.image_url}
                                alt=""
                                className="w-full rounded-md mb-2 max-h-48 object-cover"
                              />
                            )}
                            <p className="text-sm">{post.content}</p>
                            <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
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
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}

                  {(activeTab === "followers" || activeTab === "following") && (
                    listLoading ? (
                      <div className="space-y-2 py-2">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex items-center gap-2.5 animate-pulse">
                            <div className="h-8 w-8 rounded-full bg-muted" />
                            <div className="h-3 w-24 rounded bg-muted" />
                          </div>
                        ))}
                      </div>
                    ) : followList.length === 0 ? (
                      <div className="py-8 text-center">
                        <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">
                          {activeTab === "followers" ? "Nenhum seguidor ainda" : "Não segue ninguém ainda"}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        {followList.map((u: any) => (
                          <button
                            key={u.id}
                            onClick={() => {
                              onOpenChange(false);
                              setTimeout(() => {
                                window.dispatchEvent(new CustomEvent("openUserProfile", { detail: { userId: u.id } }));
                              }, 200);
                            }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent"
                          >
                            <UserAvatar
                              user={{ id: u.id, display_name: u.display_name, avatar_url: u.avatar_url }}
                              className="h-8 w-8"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{u.display_name}</div>
                              <div className="text-[11px] text-muted-foreground truncate">@{u.username}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Joined date */}
              <p className="mt-4 text-[11px] text-muted-foreground/60">
                Entrou em {new Date(userData.created_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
              </p>
            </div>
          </>
        ) : (
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Usuário não encontrado</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
