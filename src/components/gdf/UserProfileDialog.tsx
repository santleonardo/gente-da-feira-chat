"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MapPin, UserPlus, UserMinus, MessageCircle, Users, Lock, EyeOff, Loader2 } from "lucide-react";
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
  }>({ followingCount: 0, followersCount: 0, isFollowing: false });
  const [postCount, setPostCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"followers" | "following">("followers");
  const [followList, setFollowList] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);

  // Privacidade
  const [privacyInfo, setPrivacyInfo] = useState<{
    is_private: boolean;
    hide_following: boolean;
    hide_followers: boolean;
    isRestricted: boolean;
  }>({ is_private: false, hide_following: false, hide_followers: false, isRestricted: false });

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

          // Processar info de privacidade
          if (profileData._privacy) {
            setPrivacyInfo(profileData._privacy);
          }
        }

        // Buscar dados de seguidores
        const followRes = await fetch(`/api/follows?userId=${userId}`);
        const followData = await followRes.json();
        if (!followRes.ok && followData.error) {
          setFollowData({ followingCount: 0, followersCount: 0, isFollowing: false });
        } else {
          setFollowData({
            followingCount: followData.followingCount || 0,
            followersCount: followData.followersCount || 0,
            isFollowing: followData.isFollowing || false,
          });

          // Atualizar privacidade com dados do follows
          if (followData._privacy) {
            setPrivacyInfo((prev) => ({
              ...prev,
              hide_following: followData._privacy.hide_following,
              hide_followers: followData._privacy.hide_followers,
              isRestricted: followData._privacy.isRestricted ?? prev.isRestricted,
            }));
          }
        }
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

    const fetchList = async () => {
      setListLoading(true);
      try {
        const res = await fetch(`/api/follows?userId=${userId}`);
        const data = await res.json();
        if (data.error) {
          setFollowList([]);
        } else {
          // Ocultar para TODOS inclusive seguidores
          const canSeeFollowers = !data._privacy?.hide_followers;
          const canSeeFollowing = !data._privacy?.hide_following;

          let list: any[] = [];
          if (activeTab === "followers" && canSeeFollowers) {
            list = (data.followers || []).map((f: any) => f.follower).filter(Boolean);
          } else if (activeTab === "following" && canSeeFollowing) {
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
        setFollowData((prev) => ({
          ...prev,
          isFollowing: nowFollowing,
          followersCount: prev.followersCount + (nowFollowing ? 1 : -1),
        }));
        toast.success(nowFollowing ? "Seguindo!" : "Deixou de seguir");

        // Se começou a seguir e o perfil era privado, recarregar dados
        if (nowFollowing && privacyInfo.is_private) {
          setPrivacyInfo((prev) => ({ ...prev, isRestricted: false }));
          const profileRes = await fetch(`/api/users/${userId}`);
          const profileData = await profileRes.json();
          if (profileData.user) {
            setUserData(profileData.user);
            setPostCount(profileData.user._count?.posts || 0);
          }
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
  // Ocultar para TODOS inclusive seguidores — só o dono do perfil vê
  const canSeeFollowing = isOwnProfile || !privacyInfo.hide_following;
  const canSeeFollowers = isOwnProfile || !privacyInfo.hide_followers;

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
                      variant={followData.isFollowing ? "outline" : "default"}
                      className="gap-1.5 rounded-full px-4"
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
                  <p className="text-base font-bold">{isRestricted ? "-" : postCount}</p>
                  <p className="text-[11px] text-muted-foreground">Posts</p>
                </div>
                <button
                  onClick={() => {
                    if (canSeeFollowing) setActiveTab("following");
                  }}
                  className={`text-center ${canSeeFollowing ? "hover:opacity-80 transition-opacity" : "cursor-default"}`}
                >
                  <p className="text-base font-bold">
                    {canSeeFollowing ? followData.followingCount : <EyeOff className="h-4 w-4 inline text-muted-foreground" />}
                  </p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-0.5 justify-center">
                    Seguindo
                    {!canSeeFollowing && <EyeOff className="h-3 w-3" />}
                  </p>
                </button>
                <button
                  onClick={() => {
                    if (canSeeFollowers) setActiveTab("followers");
                  }}
                  className={`text-center ${canSeeFollowers ? "hover:opacity-80 transition-opacity" : "cursor-default"}`}
                >
                  <p className="text-base font-bold">
                    {canSeeFollowers ? followData.followersCount : <EyeOff className="h-4 w-4 inline text-muted-foreground" />}
                  </p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-0.5 justify-center">
                    Seguidores
                    {!canSeeFollowers && <EyeOff className="h-3 w-3" />}
                  </p>
                </button>
              </div>

              {/* Followers/Following List — só mostrar se não for restrito */}
              {!isRestricted && (
                <div className="mt-4">
                  <div className="flex border-b">
                    <button
                      onClick={() => {
                        if (canSeeFollowers) setActiveTab("followers");
                      }}
                      className={`flex-1 pb-2 text-xs font-semibold text-center transition-colors ${
                        !canSeeFollowers
                          ? "text-muted-foreground/40 cursor-not-allowed"
                          : activeTab === "followers"
                            ? "text-foreground border-b-2 border-primary"
                            : "text-muted-foreground"
                      }`}
                    >
                      <span className="flex items-center justify-center gap-1">
                        Seguidores
                        {!canSeeFollowers && <EyeOff className="h-3 w-3" />}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        if (canSeeFollowing) setActiveTab("following");
                      }}
                      className={`flex-1 pb-2 text-xs font-semibold text-center transition-colors ${
                        !canSeeFollowing
                          ? "text-muted-foreground/40 cursor-not-allowed"
                          : activeTab === "following"
                            ? "text-foreground border-b-2 border-primary"
                            : "text-muted-foreground"
                      }`}
                    >
                      <span className="flex items-center justify-center gap-1">
                        Seguindo
                        {!canSeeFollowing && <EyeOff className="h-3 w-3" />}
                      </span>
                    </button>
                  </div>

                  <div className="max-h-48 overflow-y-auto mt-2 custom-scrollbar">
                    {(activeTab === "followers" && !canSeeFollowers) || (activeTab === "following" && !canSeeFollowing) ? (
                      <div className="py-6 text-center">
                        <EyeOff className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">
                          {activeTab === "followers" ? "Lista de seguidores oculta" : "Lista de seguindo oculta"}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          Este usuário optou por manter esta informação privada
                        </p>
                      </div>
                    ) : listLoading ? (
                      <div className="space-y-2 py-2">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex items-center gap-2.5 animate-pulse">
                            <div className="h-8 w-8 rounded-full bg-muted" />
                            <div className="h-3 w-24 rounded bg-muted" />
                          </div>
                        ))}
                      </div>
                    ) : followList.length === 0 ? (
                      <div className="py-6 text-center">
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
                    )}
                  </div>
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
