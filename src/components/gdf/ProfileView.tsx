"use client";

import { useState, useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, LogOut, Edit3, Camera, Bell, Mic, Shield, ChevronLeft, MessageCircle, Heart, Trash2 } from "lucide-react";
import { getInitials, getAvatarColor, BAIRROS, timeAgo } from "@/lib/constants";
import { ThemeToggle } from "./ThemeToggle";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════
// Perfil do próprio usuário (com edição)
// ═══════════════════════════════════════════════════════════
export function ProfileView() {
  const { profile, logout, updateProfile } = useStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.display_name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [neighborhood, setNeighborhood] = useState(profile?.neighborhood || "");
  const [postCount, setPostCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [showMyPosts, setShowMyPosts] = useState(false);
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [myPostsLoading, setMyPostsLoading] = useState(false);
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

      const res = await fetch("/api/users/avatar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.user) {
        updateProfile(data.user);
        toast.success("Avatar atualizado!");
      } else if (data.error) {
        toast.error(data.error);
      }
    } catch {
      toast.error("Erro ao enviar avatar");
    }
    setUploading(false);
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

  const loadMyPosts = async () => {
    if (!profile) return;
    if (showMyPosts) { setShowMyPosts(false); return; }
    setMyPostsLoading(true);
    setShowMyPosts(true);
    try {
      const res = await fetch(`/api/users/${profile.id}/posts`);
      const data = await res.json();
      setMyPosts(data.posts || []);
    } catch { /* silent */ }
    setMyPostsLoading(false);
  };

  const deletePost = async (postId: string) => {
    try {
      await fetch(`/api/posts?id=${postId}`, { method: "DELETE" });
      setMyPosts((prev) => prev.filter((p) => p.id !== postId));
      setPostCount((c) => Math.max(0, c - 1));
      toast.success("Post excluído");
    } catch { toast.error("Erro ao excluir"); }
  };

  // Permissões
  const requestNotifications = async () => {
    try {
      const result = await Notification.requestPermission();
      if (result === "granted") {
        toast.success("Notificações ativadas!");
      } else {
        toast.error("Permissão de notificação negada");
      }
    } catch {
      toast.error("Não foi possível pedir permissão");
    }
  };

  const requestMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      toast.success("Permissão do microfone concedida!");
    } catch {
      toast.error("Permissão do microfone negada");
    }
  };

  const requestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      toast.success("Permissão da câmera concedida!");
    } catch {
      toast.error("Permissão da câmera negada");
    }
  };

  if (loading) return <div className="space-y-4">{[1,2].map(i=><div key={i} className="h-24 rounded-xl bg-muted/50 animate-pulse"/>)}</div>;

  const avatarUrl = profile?.avatar_url;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              {/* Avatar com botão de câmera */}
              <div className="relative">
                <Avatar className="h-16 w-16">
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} alt={profile?.display_name} />
                  ) : null}
                  <AvatarFallback className={`${getAvatarColor(profile?.id || "")} text-lg text-white`}>
                    {getInitials(profile?.display_name || "?")}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-110 disabled:opacity-50"
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

          {uploading && (
            <p className="mt-2 text-xs text-muted-foreground animate-pulse">Enviando avatar...</p>
          )}

          {!editing ? (
            <div className="mt-4">
              {profile?.bio ? (
                <p className="text-sm">{profile.bio}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Sem bio ainda</p>
              )}
              <div className="mt-3 flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
                  <Edit3 className="h-3.5 w-3.5" /> Editar perfil
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowPermissions(!showPermissions)} className="gap-1.5">
                  <Shield className="h-3.5 w-3.5" /> Permissões
                </Button>
              </div>
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

          {/* Painel de Permissões */}
          {showPermissions && (
            <div className="mt-4 rounded-lg border p-3 space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Shield className="h-4 w-4" /> Permissões do App
              </h3>
              <p className="text-xs text-muted-foreground">
                Permita acesso para usar todos os recursos do GDF Chat no celular.
              </p>
              <div className="space-y-2 mt-2">
                <Button variant="outline" size="sm" onClick={requestNotifications} className="w-full justify-start gap-2">
                  <Bell className="h-4 w-4" /> Notificações push
                </Button>
                <Button variant="outline" size="sm" onClick={requestMicrophone} className="w-full justify-start gap-2">
                  <Mic className="h-4 w-4" /> Microfone
                </Button>
                <Button variant="outline" size="sm" onClick={requestCamera} className="w-full justify-start gap-2">
                  <Camera className="h-4 w-4" /> Câmera
                </Button>
              </div>
            </div>
          )}

          {/* Estatísticas */}
          <div className="mt-6 flex gap-6">
            <button onClick={loadMyPosts} className="text-center hover:opacity-80 transition-opacity">
              <p className="text-lg font-bold">{postCount}</p>
              <p className="text-xs text-muted-foreground">Posts</p>
            </button>
            <div className="text-center">
              <p className="text-lg font-bold">0</p>
              <p className="text-xs text-muted-foreground">Seguindo</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">0</p>
              <p className="text-xs text-muted-foreground">Seguidores</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Meus Posts */}
      {showMyPosts && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Meus Posts</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowMyPosts(false)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Fechar
              </Button>
            </div>
            {myPostsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />
                ))}
              </div>
            ) : myPosts.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nenhum post ainda</p>
            ) : (
              <div className="space-y-3">
                {myPosts.map((post) => (
                  <div key={post.id} className="rounded-lg border p-3">
                    <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                    <div className="mt-2 flex items-center gap-3 text-muted-foreground">
                      <span className="flex items-center gap-1 text-xs">
                        <Heart className="h-3 w-3" /> {post.reactions?.length || 0}
                      </span>
                      <span className="flex items-center gap-1 text-xs">
                        <MessageCircle className="h-3 w-3" /> {post.comment_count || 0}
                      </span>
                      <span className="text-xs">{timeAgo(post.created_at)}</span>
                      <button
                        onClick={() => deletePost(post.id)}
                        className="ml-auto text-xs text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Button variant="destructive" onClick={handleLogout} className="w-full gap-2">
        <LogOut className="h-4 w-4" /> Sair da conta
      </Button>
    </div>
  );
}
