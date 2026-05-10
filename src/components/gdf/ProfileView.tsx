"use client";

import { useState, useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, LogOut, Edit3, Camera, Bell, Mic, Video, Users, UserPlus, Heart } from "lucide-react";
import { getInitials, getAvatarColor, timeAgo, BAIRROS } from "@/lib/constants";
import { UserAvatar } from "./UserAvatar";
import { ThemeToggle } from "./ThemeToggle";
import { PhotoGallery } from "./PhotoGallery";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function ProfileView() {
  const { profile, logout, updateProfile, setViewingUser } = useStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.display_name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [neighborhood, setNeighborhood] = useState(profile?.neighborhood || "");
  const [postCount, setPostCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [activeTab, setActiveTab] = useState<"fotos" | "posts" | "seguidores" | "seguindo">("fotos");
  const [followList, setFollowList] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;

    fetch(`/api/users/${profile.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setPostCount(data.user._count?.posts || 0);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch(`/api/users/${profile.id}/posts`)
      .then((r) => r.json())
      .then((data) => {
        if (data.posts) setMyPosts(data.posts);
      })
      .catch(() => {});

    fetch(`/api/follows?userId=${profile.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setFollowingCount(data.followingCount || 0);
          setFollowersCount(data.followersCount || 0);
        }
      })
      .catch(() => {});
  }, [profile]);

  useEffect(() => {
    if (!profile || activeTab === "fotos" || activeTab === "posts") return;

    const fetchList = async () => {
      setListLoading(true);
      try {
        const res = await fetch(`/api/follows?userId=${profile.id}`);
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
  }, [profile, activeTab]);

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
                <h2 className="text-lg font-bold">{profile?.display_name}</h2>
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

          {/* Stats clicáveis */}
          <div className="mt-6 flex gap-6">
            <div className="text-center">
              <p className="text-lg font-bold">{postCount}</p>
              <p className="text-xs text-muted-foreground">Posts</p>
            </div>
            <button
              onClick={() => setActiveTab("seguindo")}
              className="text-center hover:opacity-80 transition-opacity"
            >
              <p className="text-lg font-bold">{followingCount}</p>
              <p className="text-xs text-muted-foreground">Seguindo</p>
            </button>
            <button
              onClick={() => setActiveTab("seguidores")}
              className="text-center hover:opacity-80 transition-opacity"
            >
              <p className="text-lg font-bold">{followersCount}</p>
              <p className="text-xs text-muted-foreground">Seguidores</p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Abas: Fotos / Posts / Seguidores / Seguindo */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab("fotos")}
          className={`flex-1 flex items-center justify-center gap-1.5 pb-3 text-xs font-semibold transition-colors ${
            activeTab === "fotos" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Camera className="h-3.5 w-3.5" />
          Fotos
        </button>
        <button
          onClick={() => setActiveTab("posts")}
          className={`flex-1 flex items-center justify-center gap-1.5 pb-3 text-xs font-semibold transition-colors ${
            activeTab === "posts" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Heart className="h-3.5 w-3.5" />
          Posts
        </button>
        <button
          onClick={() => setActiveTab("seguidores")}
          className={`flex-1 flex items-center justify-center gap-1.5 pb-3 text-xs font-semibold transition-colors ${
            activeTab === "seguidores" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          Seguidores
        </button>
        <button
          onClick={() => setActiveTab("seguindo")}
          className={`flex-1 flex items-center justify-center gap-1.5 pb-3 text-xs font-semibold transition-colors ${
            activeTab === "seguindo" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <UserPlus className="h-3.5 w-3.5" />
          Seguindo
        </button>
      </div>

      {/* Conteúdo das abas */}
      {activeTab === "fotos" && profile && (
        <PhotoGallery userId={profile.id} isOwnProfile={true} />
      )}

      {activeTab === "posts" && (
        <div>
          {myPosts.length === 0 ? (
            <div className="py-8 text-center">
              <Heart className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum post ainda</p>
            </div>
          ) : (
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
          )}
        </div>
      )}

      {(activeTab === "seguidores" || activeTab === "seguindo") && (
        <div>
          {listLoading ? (
            <div className="space-y-2 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="h-10 w-10 rounded-full bg-muted" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-28 rounded bg-muted" />
                    <div className="h-2.5 w-20 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : followList.length === 0 ? (
            <div className="py-8 text-center">
              <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {activeTab === "seguidores" ? "Nenhum seguidor ainda" : "Não segue ninguém ainda"}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {followList.map((u: any) => (
                <button
                  key={u.id}
                  onClick={() => setViewingUser(u.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-accent"
                >
                  <UserAvatar
                    user={{ id: u.id, display_name: u.display_name, avatar_url: u.avatar_url }}
                    className="h-10 w-10"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{u.display_name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">@{u.username}</div>
                    {u.neighborhood && (
                      <div className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5 mt-0.5">
                        <MapPin className="h-2.5 w-2.5" />
                        {u.neighborhood}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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

      <Button variant="destructive" onClick={handleLogout} className="w-full gap-2">
        <LogOut className="h-4 w-4" /> Sair da conta
      </Button>
    </div>
  );
}
