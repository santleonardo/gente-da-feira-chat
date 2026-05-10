"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { MapPin, UserPlus, UserMinus, MessageCircle, Users, Camera } from "lucide-react";
import { UserAvatar } from "./UserAvatar";
import { PhotoGallery } from "./PhotoGallery";
import { toast } from "sonner";

interface UserProfileDialogProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserProfileDialog({ userId, open, onOpenChange }: UserProfileDialogProps) {
  const { profile } = useStore();
  const [userData, setUserData] = useState<any>(null);
  const [followData, setFollowData] = useState<{ followingCount: number; followersCount: number; isFollowing: boolean }>({ followingCount: 0, followersCount: 0, isFollowing: false });
  const [postCount, setPostCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"followers" | "following" | "fotos">("fotos");
  const [followList, setFollowList] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);

  useEffect(() => {
    if (!userId || !open) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const profileRes = await fetch(`/api/users/${userId}`);
        const profileData = await profileRes.json();
        if (profileData.user) { setUserData(profileData.user); setPostCount(profileData.user._count?.posts || 0); }
        const followRes = await fetch(`/api/follows?userId=${userId}`);
        const followData = await followRes.json();
        if (!followRes.ok && followData.error) { setFollowData({ followingCount: 0, followersCount: 0, isFollowing: false }); }
        else { setFollowData({ followingCount: followData.followingCount || 0, followersCount: followData.followersCount || 0, isFollowing: followData.isFollowing || false }); }
      } catch { /* silent */ }
      setLoading(false);
    };
    fetchData();
  }, [userId, open]);

  useEffect(() => {
    if (!userId || !open || activeTab === "fotos") return;
    const fetchList = async () => {
      setListLoading(true);
      try {
        const res = await fetch(`/api/follows?userId=${userId}`);
        const data = await res.json();
        if (data.error) { setFollowList([]); }
        else {
          const list = activeTab === "followers" ? (data.followers || []).map((f: any) => f.follower).filter(Boolean) : (data.following || []).map((f: any) => f.following).filter(Boolean);
          setFollowList(list);
        }
      } catch { setFollowList([]); }
      setListLoading(false);
    };
    fetchList();
  }, [userId, open, activeTab]);

  const handleFollowToggle = async () => {
    if (!userId || !profile || profile.id === userId || followLoading) return;
    setFollowLoading(true);
    try {
      const res = await fetch("/api/follows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetUserId: userId }) });
      const data = await res.json();
      if (data.error) { toast.error(data.error); }
      else { const nowFollowing = data.following; setFollowData((prev) => ({ ...prev, isFollowing: nowFollowing, followersCount: prev.followersCount + (nowFollowing ? 1 : -1) })); toast.success(nowFollowing ? "Seguindo!" : "Deixou de seguir"); }
    } catch { toast.error("Erro ao seguir"); }
    setFollowLoading(false);
  };

  const handleStartDM = async () => {
    if (!profile || !userId) return;
    try {
      const res = await fetch("/api/dm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receiverId: userId }) });
      const data = await res.json();
      if (data.conversation) { useStore.getState().setSelectedDM(data.conversation); useStore.getState().setTab("dms"); onOpenChange(false); }
    } catch { toast.error("Erro ao iniciar conversa"); }
  };

  const isOwnProfile = profile?.id === userId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
        {loading ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-4"><div className="h-16 w-16 rounded-full bg-muted animate-pulse" /><div className="space-y-2 flex-1"><div className="h-5 w-32 rounded bg-muted animate-pulse" /><div className="h-3 w-24 rounded bg-muted animate-pulse" /></div></div>
            <div className="h-4 w-full rounded bg-muted animate-pulse" />
          </div>
        ) : userData ? (
          <>
            <div className="h-20 bg-gradient-to-br from-primary/30 via-primary/10 to-transparent" />
            <div className="px-5 pb-5 -mt-8">
              <div className="flex items-end justify-between mb-3">
                <UserAvatar user={{ id: userId!, display_name: userData.display_name, avatar_url: userData.avatar_url }} className="h-16 w-16 border-4 border-background shadow-lg" />
                {!isOwnProfile && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleStartDM} className="gap-1.5 rounded-full px-3"><MessageCircle className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" onClick={handleFollowToggle} disabled={followLoading} variant={followData.isFollowing ? "outline" : "default"} className="gap-1.5 rounded-full px-4">
                      {followData.isFollowing ? (<><UserMinus className="h-3.5 w-3.5" />Deixar de seguir</>) : (<><UserPlus className="h-3.5 w-3.5" />Seguir</>)}
                    </Button>
                  </div>
                )}
              </div>
              <h2 className="text-lg font-bold leading-tight">{userData.display_name}</h2>
              <p className="text-sm text-muted-foreground">@{userData.username}</p>
              {userData.neighborhood && <Badge variant="secondary" className="mt-2 gap-1"><MapPin className="h-3 w-3" /> {userData.neighborhood}</Badge>}
              {userData.bio ? <p className="mt-3 text-sm leading-relaxed">{userData.bio}</p> : <p className="mt-3 text-sm text-muted-foreground italic">Sem bio ainda</p>}

              <div className="mt-4 flex gap-5">
                <div className="text-center"><p className="text-base font-bold">{postCount}</p><p className="text-[11px] text-muted-foreground">Posts</p></div>
                <button onClick={() => setActiveTab("following")} className="text-center hover:opacity-80 transition-opacity"><p className="text-base font-bold">{followData.followingCount}</p><p className="text-[11px] text-muted-foreground">Seguindo</p></button>
                <button onClick={() => setActiveTab("followers")} className="text-center hover:opacity-80 transition-opacity"><p className="text-base font-bold">{followData.followersCount}</p><p className="text-[11px] text-muted-foreground">Seguidores</p></button>
              </div>

              <div className="mt-4">
                <div className="flex border-b">
                  <button onClick={() => setActiveTab("fotos")} className={`flex-1 pb-2 text-xs font-semibold text-center transition-colors flex items-center justify-center gap-1 ${activeTab === "fotos" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground"}`}><Camera className="h-3 w-3" />Fotos</button>
                  <button onClick={() => setActiveTab("followers")} className={`flex-1 pb-2 text-xs font-semibold text-center transition-colors ${activeTab === "followers" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground"}`}>Seguidores</button>
                  <button onClick={() => setActiveTab("following")} className={`flex-1 pb-2 text-xs font-semibold text-center transition-colors ${activeTab === "following" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground"}`}>Seguindo</button>
                </div>

                {activeTab === "fotos" && userId && (<div className="mt-3"><PhotoGallery userId={userId} isOwnProfile={isOwnProfile} /></div>)}

                {(activeTab === "followers" || activeTab === "following") && (
                  <div className="max-h-48 overflow-y-auto mt-2 custom-scrollbar">
                    {listLoading ? (<div className="space-y-2 py-2">{[1, 2, 3].map((i) => (<div key={i} className="flex items-center gap-2.5 animate-pulse"><div className="h-8 w-8 rounded-full bg-muted" /><div className="h-3 w-24 rounded bg-muted" /></div>))}</div>)
                    : followList.length === 0 ? (<div className="py-6 text-center"><Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" /><p className="text-xs text-muted-foreground">{activeTab === "followers" ? "Nenhum seguidor ainda" : "Não segue ninguém ainda"}</p></div>)
                    : (<div className="space-y-0.5">{followList.map((u: any) => (<button key={u.id} onClick={() => { onOpenChange(false); setTimeout(() => { window.dispatchEvent(new CustomEvent("openUserProfile", { detail: { userId: u.id } })); }, 200); }} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent"><UserAvatar user={{ id: u.id, display_name: u.display_name, avatar_url: u.avatar_url }} className="h-8 w-8" /><div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{u.display_name}</div><div className="text-[11px] text-muted-foreground truncate">@{u.username}</div></div></button>))}</div>)}
                  </div>
                )}
              </div>
              <p className="mt-4 text-[11px] text-muted-foreground/60">Entrou em {new Date(userData.created_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
            </div>
          </>
        ) : (
          <div className="p-6 text-center"><p className="text-sm text-muted-foreground">Usuário não encontrado</p></div>
        )}
      </DialogContent>
    </Dialog>
  );
}
