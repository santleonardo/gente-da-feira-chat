"use client";

import { useState, useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MapPin, LogOut, Edit3, Camera, Bell, Mic, Video, Shield, Lock, EyeOff,
  UserCheck, Check, X, BellRing, UserX, Ban, Users, Trash2
} from "lucide-react";
import { getInitials, getAvatarColor, timeAgo, BAIRROS } from "@/lib/constants";
import { UserAvatar } from "./UserAvatar";
import { ThemeToggle } from "./ThemeToggle";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function ProfileView() {
  const { profile, logout, updateProfile } = useStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.display_name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [neighborhood, setNeighborhood] = useState(profile?.neighborhood || "");
  const [postCount, setPostCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Privacidade
  const [isPrivate, setIsPrivate] = useState(profile?.is_private || false);
  const [hideFollowing, setHideFollowing] = useState(profile?.hide_following || false);
  const [hideFollowers, setHideFollowers] = useState(profile?.hide_followers || false);
  const [approveFollowers, setApproveFollowers] = useState(profile?.approve_followers || false);
  const [privacyLoading, setPrivacyLoading] = useState(false);

  // Solicitações de seguidores
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Notificações
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  // Seguidores (para remover)
  const [myFollowers, setMyFollowers] = useState<any[]>([]);
  const [showFollowers, setShowFollowers] = useState(false);
  const [removeLoading, setRemoveLoading] = useState<string | null>(null);

  // Bloqueados
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [showBlocked, setShowBlocked] = useState(false);
  const [unblockLoading, setUnblockLoading] = useState<string | null>(null);

  // Sincronizar com profile do store
  useEffect(() => {
    if (profile) {
      setIsPrivate(profile.is_private || false);
      setHideFollowing(profile.hide_following || false);
      setHideFollowers(profile.hide_followers || false);
      setApproveFollowers(profile.approve_followers || false);
    }
  }, [profile?.is_private, profile?.hide_following, profile?.hide_followers, profile?.approve_followers]);

  useEffect(() => {
    if (!profile) return;

    fetch(`/api/users/${profile.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setPostCount(data.user._count?.posts || 0);
          if (data.user.is_private !== undefined) setIsPrivate(data.user.is_private);
          if (data.user.hide_following !== undefined) setHideFollowing(data.user.hide_following);
          if (data.user.hide_followers !== undefined) setHideFollowers(data.user.hide_followers);
          if (data.user.approve_followers !== undefined) setApproveFollowers(data.user.approve_followers);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Buscar contadores de seguidores e solicitações
    fetch(`/api/follows?userId=${profile.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setFollowingCount(data.followingCount || 0);
          setFollowersCount(data.followersCount || 0);
          setPendingCount(data.pendingCount || 0);
          setPendingRequests(data.pendingRequests || []);
        }
      })
      .catch(() => {});

    // Buscar meus posts
    fetch(`/api/users/${profile.id}/posts`)
      .then((r) => r.json())
      .then((data) => {
        if (data.posts) setMyPosts(data.posts);
      })
      .catch(() => {});

    // Buscar notificações
    fetchNotifications();
  }, [profile]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      if (data.notifications) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount || 0);
        useStore.getState().setUnreadNotifications(data.unreadCount || 0);
      }
    } catch { /* silent */ }
  };

  const markNotificationsRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      useStore.getState().setUnreadNotifications(0);
    } catch { /* silent */ }
  };

  const handleAcceptRequest = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const res = await fetch("/api/follows/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action: "accept" }),
      });
      const data = await res.json();
      if (data.accepted) {
        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
        setPendingCount((prev) => prev - 1);
        setFollowersCount((prev) => prev + 1);
        toast.success("Solicitação aceita!");
      } else {
        toast.error(data.error || "Erro ao aceitar");
      }
    } catch {
      toast.error("Erro ao aceitar solicitação");
    }
    setActionLoading(null);
  };

  const handleRejectRequest = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const res = await fetch("/api/follows/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action: "reject" }),
      });
      const data = await res.json();
      if (data.rejected) {
        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
        setPendingCount((prev) => prev - 1);
        toast.success("Solicitação recusada");
      } else {
        toast.error(data.error || "Erro ao recusar");
      }
    } catch {
      toast.error("Erro ao recusar solicitação");
    }
    setActionLoading(null);
  };

  const handleSave = async () => {
    if (!profile) return;
    try {
      const res = await fetch(`/api/users/${profile.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim().slice(0, 50),
          bio: bio.trim().slice(0, 300),
          neighborhood,
        }),
      });
      const data = await res.json();
      if (data.user) {
        updateProfile(data.user);
        setEditing(false);
        toast.success("Perfil atualizado!");
      }
    } catch { toast.error("Erro ao salvar"); }
  };

  const handlePrivacyChange = async (field: "is_private" | "hide_following" | "hide_followers" | "approve_followers", value: boolean) => {
    if (!profile) return;
    setPrivacyLoading(true);

    if (field === "is_private") setIsPrivate(value);
    if (field === "hide_following") setHideFollowing(value);
    if (field === "hide_followers") setHideFollowers(value);
    if (field === "approve_followers") setApproveFollowers(value);

    try {
      const res = await fetch(`/api/users/${profile.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await res.json();
      if (data.user) {
        updateProfile(data.user);
        if (field === "approve_followers" && !value) {
          setPendingRequests([]);
          setPendingCount(0);
          toast.success("Aprovação desativada — solicitações pendentes foram aceitas automaticamente");
          fetch(`/api/follows?userId=${profile.id}`)
            .then((r) => r.json())
            .then((d) => {
              if (!d.error) setFollowersCount(d.followersCount || 0);
            })
            .catch(() => {});
        } else {
          toast.success(value
            ? field === "is_private" ? "Perfil agora é privado" : field === "approve_followers" ? "Aprovação de seguidores ativada" : "Lista oculta"
            : field === "is_private" ? "Perfil agora é público" : field === "approve_followers" ? "Aprovação de seguidores desativada" : "Lista visível"
          );
        }
      } else {
        if (field === "is_private") setIsPrivate(!value);
        if (field === "hide_following") setHideFollowing(!value);
        if (field === "hide_followers") setHideFollowers(!value);
        if (field === "approve_followers") setApproveFollowers(!value);
        toast.error("Erro ao atualizar privacidade");
      }
    } catch {
      if (field === "is_private") setIsPrivate(!value);
      if (field === "hide_following") setHideFollowing(!value);
      if (field === "hide_followers") setHideFollowers(!value);
      if (field === "approve_followers") setApproveFollowers(!value);
      toast.error("Erro ao atualizar privacidade");
    }
    setPrivacyLoading(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 2MB)");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", profile.id);
      const res = await fetch("/api/users/avatar", { method: "POST", body: formData });
      const data = await res.json();
      if (data.avatar_url) {
        updateProfile({ avatar_url: data.avatar_url });
        toast.success("Avatar atualizado!");
      } else {
        toast.error(data.error || "Erro ao enviar avatar");
      }
    } catch { toast.error("Erro ao enviar avatar"); }
    setUploading(false);
  };

  const handleRemoveFollower = async (followerId: string) => {
    if (!profile) return;
    setRemoveLoading(followerId);
    try {
      const res = await fetch("/api/follows", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followerId }),
      });
      const data = await res.json();
      if (data.removed) {
        setMyFollowers((prev) => prev.filter((f: any) => (f.follower?.id || f.follower_id) !== followerId));
        setFollowersCount((prev) => prev - 1);
        toast.success("Seguidor removido");
      } else {
        toast.error(data.error || "Erro ao remover");
      }
    } catch { toast.error("Erro ao remover seguidor"); }
    setRemoveLoading(null);
  };

  const handleUnblock = async (blockedId: string) => {
    setUnblockLoading(blockedId);
    try {
      const res = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: blockedId }),
      });
      const data = await res.json();
      if (!data.blocked) {
        setBlockedUsers((prev) => prev.filter((b: any) => b.blocked?.id !== blockedId && b.blocked_id !== blockedId));
        toast.success("Usuário desbloqueado");
      } else {
        toast.error("Erro ao desbloquear");
      }
    } catch { toast.error("Erro ao desbloquear"); }
    setUnblockLoading(null);
  };

  const openFollowersList = async () => {
    if (!profile) return;
    setShowFollowers(true);
    try {
      const res = await fetch(`/api/follows?userId=${profile.id}`);
      const data = await res.json();
      if (data.followers) {
        setMyFollowers(data.followers);
      }
    } catch { /* silent */ }
  };

  const openBlockedList = async () => {
    if (!profile) return;
    setShowBlocked(true);
    try {
      const res = await fetch("/api/blocks");
      const data = await res.json();
      if (data.blocks) {
        setBlockedUsers(data.blocks);
      }
    } catch { /* silent */ }
  };

  const requestPermission = async (type: "notifications" | "microphone" | "camera") => {
    try {
      if (type === "notifications") {
        const result = await Notification.requestPermission();
        if (result === "granted") toast.success("Notificações ativadas!");
        else toast.error("Permissão de notificação negada");
      } else if (type === "microphone") {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        toast.success("Microfone permitido!");
      } else if (type === "camera") {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((t) => t.stop());
        toast.success("Câmera permitida!");
      }
    } catch {
      toast.error(`Permissão de ${type === "microphone" ? "microfone" : type === "camera" ? "câmera" : "notificação"} negada`);
    }
  };

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.removeAllChannels();
      await supabase.auth.signOut();
      logout();
    } catch { toast.error("Erro ao sair"); }
  };

  if (loading) return <div className="space-y-4">{[1,2].map(i=><div key={i} className="h-24 rounded-xl bg-muted/50 animate-pulse"/>)}</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="relative">
                <UserAvatar
                  user={{ id: profile?.id || "", display_name: profile?.display_name || "?", avatar_url: profile?.avatar_url }}
                  className="h-16 w-16"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-lg font-bold">{profile?.display_name}</h2>
                  {isPrivate && <Lock className="h-4 w-4 text-muted-foreground" />}
                </div>
                <p className="text-sm text-muted-foreground">@{profile?.username}</p>
                {profile?.neighborhood && (
                  <Badge variant="secondary" className="mt-1.5 gap-1">
                    <MapPin className="h-3 w-3" /> {profile.neighborhood}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowNotifications(true); markNotificationsRead(); }}
                className="relative flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              <ThemeToggle />
            </div>
          </div>

          {!editing ? (
            <div className="mt-4">
              {profile?.bio ? (
                <p className="text-sm">{profile.bio}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Sem bio ainda</p>
              )}
              <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="mt-3 gap-1.5">
                <Edit3 className="h-3.5 w-3.5" /> Editar perfil
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
              </div>
              <div className="space-y-1.5">
                <Label>Bio</Label>
                <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={300} />
                <span className="text-xs text-muted-foreground">{bio.length}/300</span>
              </div>
              <div className="space-y-1.5">
                <Label>Bairro</Label>
                <select
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Nenhum</option>
                  {BAIRROS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} size="sm">Salvar</Button>
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
              </div>
            </div>
          )}

          <div className="mt-6 flex gap-6">
            <div className="text-center">
              <p className="text-lg font-bold">{postCount}</p>
              <p className="text-xs text-muted-foreground">Posts</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">{followingCount}</p>
              <p className="text-xs text-muted-foreground">Seguindo</p>
            </div>
            <button onClick={openFollowersList} className="text-center hover:opacity-80 transition-opacity">
              <p className="text-lg font-bold">{followersCount}</p>
              <p className="text-xs text-muted-foreground">Seguidores</p>
            </button>
            {approveFollowers && pendingCount > 0 && (
              <div className="text-center">
                <p className="text-lg font-bold text-orange-500">{pendingCount}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Solicitações de seguidores */}
      {approveFollowers && pendingCount > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-orange-500" />
                <h3 className="text-sm font-semibold">Solicitações de seguidores</h3>
              </div>
              <Badge variant="secondary" className="text-xs">{pendingCount} {pendingCount === 1 ? "pendente" : "pendentes"}</Badge>
            </div>
            <div className="space-y-2">
              {pendingRequests.map((req: any) => (
                <div key={req.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                  <UserAvatar
                    user={{
                      id: req.follower?.id || req.follower_id,
                      display_name: req.follower?.display_name || "?",
                      avatar_url: req.follower?.avatar_url,
                    }}
                    className="h-9 w-9"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{req.follower?.display_name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">@{req.follower?.username}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 w-7 p-0 rounded-full"
                      disabled={actionLoading === req.id}
                      onClick={() => handleAcceptRequest(req.id)}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 p-0 rounded-full"
                      disabled={actionLoading === req.id}
                      onClick={() => handleRejectRequest(req.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Privacidade */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Privacidade</h3>
          </div>
          <div className="space-y-4">
            {/* Perfil privado */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-sm font-medium">Perfil privado</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Quem não te segue não verá seus posts e informações
                </p>
              </div>
              <Switch
                checked={isPrivate}
                onCheckedChange={(v) => handlePrivacyChange("is_private", v)}
                disabled={privacyLoading}
              />
            </div>

            <div className="border-t" />

            {/* Aprovar seguidores */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-sm font-medium">Aprovar seguidores</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Quem quiser te seguir precisará da sua aprovação
                </p>
              </div>
              <Switch
                checked={approveFollowers}
                onCheckedChange={(v) => handlePrivacyChange("approve_followers", v)}
                disabled={privacyLoading}
              />
            </div>

            <div className="border-t" />

            {/* Esconder seguindo */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-sm font-medium">Esconder seguindo</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Outros não verão quem você está seguindo
                </p>
              </div>
              <Switch
                checked={hideFollowing}
                onCheckedChange={(v) => handlePrivacyChange("hide_following", v)}
                disabled={privacyLoading}
              />
            </div>

            <div className="border-t" />

            {/* Esconder seguidores */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-sm font-medium">Esconder seguidores</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Outros não verão seus seguidores
                </p>
              </div>
              <Switch
                checked={hideFollowers}
                onCheckedChange={(v) => handlePrivacyChange("hide_followers", v)}
                disabled={privacyLoading}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gerenciar seguidores e bloqueados */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Gerenciar</h3>
          </div>
          <div className="space-y-2">
            <Button variant="outline" size="sm" onClick={openFollowersList} className="w-full justify-start gap-2">
              <UserX className="h-4 w-4" /> Remover seguidor
            </Button>
            <Button variant="outline" size="sm" onClick={openBlockedList} className="w-full justify-start gap-2">
              <Ban className="h-4 w-4" /> Usuários bloqueados
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Permissões do celular */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-sm font-semibold mb-3">Permissões do dispositivo</h3>
          <div className="space-y-2">
            <Button variant="outline" size="sm" onClick={() => requestPermission("notifications")} className="w-full justify-start gap-2">
              <Bell className="h-4 w-4" /> Notificações
            </Button>
            <Button variant="outline" size="sm" onClick={() => requestPermission("microphone")} className="w-full justify-start gap-2">
              <Mic className="h-4 w-4" /> Microfone
            </Button>
            <Button variant="outline" size="sm" onClick={() => requestPermission("camera")} className="w-full justify-start gap-2">
              <Video className="h-4 w-4" /> Câmera
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Meus Posts */}
      {myPosts.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Meus posts</h3>
          <div className="space-y-2">
            {myPosts.map((post: any) => (
              <div key={post.id} className="rounded-lg border bg-card p-3">
                <p className="text-sm">{post.content}</p>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{timeAgo(post.created_at)}</span>
                  {post.neighborhood && <span>· {post.neighborhood}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button variant="destructive" onClick={handleLogout} className="w-full gap-2">
        <LogOut className="h-4 w-4" /> Sair da conta
      </Button>

      {/* ===== Dialogs ===== */}

      {/* Notificações */}
      <Dialog open={showNotifications} onOpenChange={setShowNotifications}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogTitle>Notificações</DialogTitle>
          <div className="flex-1 overflow-y-auto space-y-1 mt-2">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <BellRing className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nenhuma notificação ainda</p>
              </div>
            ) : (
              notifications.map((n: any) => (
                <button
                  key={n.id}
                  onClick={() => {
                    if (n.from_user?.id) {
                      setShowNotifications(false);
                      setTimeout(() => {
                        window.dispatchEvent(new CustomEvent("openUserProfile", { detail: { userId: n.from_user.id } }));
                      }, 200);
                    }
                  }}
                  className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent ${
                    !n.read ? "bg-primary/5" : ""
                  }`}
                >
                  <UserAvatar
                    user={{ id: n.from_user?.id || "", display_name: n.from_user?.display_name || "?", avatar_url: n.from_user?.avatar_url }}
                    className="h-8 w-8 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <strong>{n.from_user?.display_name}</strong> {n.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.read && (
                    <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Remover seguidores */}
      <Dialog open={showFollowers} onOpenChange={setShowFollowers}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogTitle>Remover seguidor</DialogTitle>
          <p className="text-xs text-muted-foreground mb-2">O seguidor removido não será notificado.</p>
          <div className="flex-1 overflow-y-auto space-y-1">
            {myFollowers.length === 0 ? (
              <div className="py-8 text-center">
                <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nenhum seguidor</p>
              </div>
            ) : (
              myFollowers.map((f: any) => {
                const follower = f.follower || f;
                const followerId = follower.id || f.follower_id;
                return (
                  <div key={followerId} className="flex items-center gap-2.5 rounded-lg px-2 py-2">
                    <UserAvatar
                      user={{ id: followerId, display_name: follower.display_name, avatar_url: follower.avatar_url }}
                      className="h-8 w-8"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{follower.display_name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">@{follower.username}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
                      disabled={removeLoading === followerId}
                      onClick={() => handleRemoveFollower(followerId)}
                    >
                      <Trash2 className="h-3 w-3" /> Remover
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Usuários bloqueados */}
      <Dialog open={showBlocked} onOpenChange={setShowBlocked}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogTitle>Usuários bloqueados</DialogTitle>
          <div className="flex-1 overflow-y-auto space-y-1 mt-2">
            {blockedUsers.length === 0 ? (
              <div className="py-8 text-center">
                <Ban className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nenhum usuário bloqueado</p>
              </div>
            ) : (
              blockedUsers.map((b: any) => {
                const blocked = b.blocked || b;
                const blockedId = blocked.id || b.blocked_id;
                return (
                  <div key={blockedId} className="flex items-center gap-2.5 rounded-lg px-2 py-2">
                    <UserAvatar
                      user={{ id: blockedId, display_name: blocked.display_name || "Usuário", avatar_url: blocked.avatar_url }}
                      className="h-8 w-8"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{blocked.display_name || "Usuário"}</p>
                      <p className="text-[11px] text-muted-foreground truncate">@{blocked.username || ""}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      disabled={unblockLoading === blockedId}
                      onClick={() => handleUnblock(blockedId)}
                    >
                      Desbloquear
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
