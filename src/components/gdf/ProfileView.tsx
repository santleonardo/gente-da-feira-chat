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
import { MapPin, LogOut, Edit3, Camera, Bell, Mic, Video, Shield, Lock, EyeOff } from "lucide-react";
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
  const [privacyLoading, setPrivacyLoading] = useState(false);

  // Sincronizar com profile do store
  useEffect(() => {
    if (profile) {
      setIsPrivate(profile.is_private || false);
      setHideFollowing(profile.hide_following || false);
      setHideFollowers(profile.hide_followers || false);
    }
  }, [profile?.is_private, profile?.hide_following, profile?.hide_followers]);

  useEffect(() => {
    if (!profile) return;
    fetch(`/api/users/${profile.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setPostCount(data.user._count?.posts || 0);
          // Sincronizar privacidade do servidor
          if (data.user.is_private !== undefined) setIsPrivate(data.user.is_private);
          if (data.user.hide_following !== undefined) setHideFollowing(data.user.hide_following);
          if (data.user.hide_followers !== undefined) setHideFollowers(data.user.hide_followers);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Buscar contadores de seguidores
    fetch(`/api/follows?userId=${profile.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setFollowingCount(data.followingCount || 0);
          setFollowersCount(data.followersCount || 0);
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
  }, [profile]);

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

  const handlePrivacyChange = async (field: "is_private" | "hide_following" | "hide_followers", value: boolean) => {
    if (!profile) return;
    setPrivacyLoading(true);

    // Atualizar UI imediatamente
    if (field === "is_private") setIsPrivate(value);
    if (field === "hide_following") setHideFollowing(value);
    if (field === "hide_followers") setHideFollowers(value);

    try {
      const res = await fetch(`/api/users/${profile.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await res.json();
      if (data.user) {
        updateProfile(data.user);
        toast.success(value
          ? field === "is_private" ? "Perfil agora é privado" : "Lista oculta"
          : field === "is_private" ? "Perfil agora é público" : "Lista visível"
        );
      } else {
        // Reverter em caso de erro
        if (field === "is_private") setIsPrivate(!value);
        if (field === "hide_following") setHideFollowing(!value);
        if (field === "hide_followers") setHideFollowers(!value);
        toast.error("Erro ao atualizar privacidade");
      }
    } catch {
      // Reverter em caso de erro
      if (field === "is_private") setIsPrivate(!value);
      if (field === "hide_following") setHideFollowing(!value);
      if (field === "hide_followers") setHideFollowers(!value);
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

      const res = await fetch("/api/users/avatar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.avatar_url) {
        updateProfile({ avatar_url: data.avatar_url });
        toast.success("Avatar atualizado!");
      } else {
        toast.error(data.error || "Erro ao enviar avatar");
      }
    } catch {
      toast.error("Erro ao enviar avatar");
    }
    setUploading(false);
  };

  const requestPermission = async (type: "notifications" | "microphone" | "camera") => {
    try {
      if (type === "notifications") {
        const result = await Notification.requestPermission();
        if (result === "granted") {
          toast.success("Notificações ativadas!");
        } else {
          toast.error("Permissão de notificação negada");
        }
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
    } catch {
      toast.error("Erro ao sair");
    }
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
            <div className="flex gap-2">
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
            <div className="text-center">
              <p className="text-lg font-bold">{followersCount}</p>
              <p className="text-xs text-muted-foreground">Seguidores</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}
