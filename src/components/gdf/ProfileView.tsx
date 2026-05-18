"use client";

import { useState, useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  MapPin,
  LogOut,
  Edit3,
  Camera,
  Settings,
  Lock,
  Loader2,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ChevronDown,
  Type,
} from "lucide-react";
import { getInitials, getAvatarColor, timeAgo, BAIRROS } from "@/lib/constants";
import { UserAvatar } from "./UserAvatar";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════
// Post-it colors (mesmas do FeedView)
// ═══════════════════════════════════════════════════════════
const POST_IT_COLORS = [
  { bg: "#fef9c3", text: "#5c4f1e", border: "#fde68a", label: "Amarelo" },
  { bg: "#fecdd3", text: "#7c2d35", border: "#fda4af", label: "Rosa" },
  { bg: "#bae6fd", text: "#1e5070", border: "#7dd3fc", label: "Azul" },
  { bg: "#bbf7d0", text: "#2d5a3a", border: "#86efac", label: "Verde" },
  { bg: "#fed7aa", text: "#6b3a15", border: "#fdba74", label: "Laranja" },
  { bg: "#ddd6fe", text: "#4a3580", border: "#c4b5fd", label: "Roxo" },
  { bg: "#fecaca", text: "#6b2020", border: "#fca5a5", label: "Coral" },
  { bg: "#a7f3d0", text: "#1a5a3a", border: "#6ee7b7", label: "Menta" },
  { bg: "#c4b5fd", text: "#3b2d70", border: "#a78bfa", label: "Lavanda" },
  { bg: "#fde68a", text: "#6b4e10", border: "#fbbf24", label: "Pêssego" },
] as const;

// ═══════════════════════════════════════════════════════════
// Fontes disponíveis
// ═══════════════════════════════════════════════════════════
const FONTS = [
  { name: "Nunito", value: "Nunito" },
  { name: "Quicksand", value: "Quicksand" },
  { name: "Poppins", value: "Poppins" },
  { name: "Inter", value: "Inter" },
  { name: "Comfortaa", value: "Comfortaa" },
  { name: "Montserrat", value: "Montserrat" },
  { name: "Lato", value: "Lato" },
  { name: "Raleway", value: "Raleway" },
  { name: "DM Sans", value: "DM Sans" },
  { name: "Work Sans", value: "Work Sans" },
] as const;

// ═══════════════════════════════════════════════════════════
// Interface do estilo do post
// ═══════════════════════════════════════════════════════════
interface PostStyle {
  font?: string | null;
  bold?: boolean;
  italic?: boolean;
  alignment?: "left" | "center" | "right" | "justify";
  postItColor?: number | null;
}

export function ProfileView() {
  const { profile, logout, updateProfile, setProfileSubView, unreadNotifications } = useStore();
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

  // ═══════ Composer state ═══════
  const [content, setContent] = useState("");
  const [postStyle, setPostStyle] = useState<PostStyle>({
    font: null,
    bold: false,
    italic: false,
    alignment: "left",
    postItColor: 0,
  });
  const [publishing, setPublishing] = useState(false);
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const fontMenuRef = useRef<HTMLDivElement>(null);

  // Carregar Google Fonts
  useEffect(() => {
    const fontsParam = FONTS.map(
      (f) => `family=${f.value.replace(/ /g, "+")}:wght@400;700`
    ).join("&");
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${fontsParam}&display=swap`;
    document.head.appendChild(link);
  }, []);

  // Fechar menu de fontes ao clicar fora
  useEffect(() => {
    if (!fontMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (fontMenuRef.current && !fontMenuRef.current.contains(e.target as Node)) {
        setFontMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [fontMenuOpen]);

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

    fetch(`/api/follows?userId=${profile.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setFollowingCount(data.followingCount || 0);
          setFollowersCount(data.followersCount || 0);
        }
      })
      .catch(() => {});

    fetchMyPosts();
  }, [profile]);

  const fetchMyPosts = () => {
    if (!profile) return;
    fetch(`/api/users/${profile.id}/posts`)
      .then((r) => r.json())
      .then((data) => {
        if (data.posts) setMyPosts(data.posts);
      })
      .catch(() => {});
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

  // ═══════ Publicar post com estilo ═══════
  const handlePublish = async () => {
    if (!profile || !content.trim()) return;
    setPublishing(true);
    try {
      const styleToSend: PostStyle = { ...postStyle };
      // Remover valores default para economizar espaço
      if (!styleToSend.font) delete styleToSend.font;
      if (!styleToSend.bold) delete styleToSend.bold;
      if (!styleToSend.italic) delete styleToSend.italic;
      if (styleToSend.alignment === "left") delete styleToSend.alignment;
      if (styleToSend.postItColor === null || styleToSend.postItColor === undefined) delete styleToSend.postItColor;

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          neighborhood: profile.neighborhood,
          imageUrls: [],
          videoUrl: null,
          audioUrl: null,
          visibility: "public",
          postStyle: styleToSend,
        }),
      });
      const data = await res.json();
      if (data.post) {
        setContent("");
        setPostStyle({ font: null, bold: false, italic: false, alignment: "left", postItColor: 0 });
        toast.success("Post publicado!");
        fetchMyPosts();
      } else if (data.error) {
        toast.error(data.error);
      }
    } catch {
      toast.error("Erro ao publicar");
    }
    setPublishing(false);
  };

  if (loading) return <div className="space-y-4">{[1,2].map(i=><div key={i} className="h-24 rounded-xl bg-[#01386A]/[0.04] animate-pulse"/>)}</div>;

  const isPrivate = profile?.is_private || false;

  // Cor do post-it selecionada
  const selectedColor = POST_IT_COLORS[postStyle.postItColor ?? 0];

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
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#f7f9fa] bg-[#01386A] text-[#f7f9fa] shadow-sm transition-colors hover:bg-[#01386A]/90">
                  <Camera className="h-3.5 w-3.5" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleAvatarUpload} className="hidden" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-lg font-bold text-[#000305]">{profile?.display_name}</h2>
                  {isPrivate && <Lock className="h-4 w-4 text-[#01386A]/40" />}
                </div>
                <p className="text-sm text-[#01386A]/40">@{profile?.username}</p>
                {profile?.neighborhood && (
                  <Badge variant="secondary" className="mt-1.5 gap-1 bg-[#01386A]/10 text-[#01386A] border-0">
                    <MapPin className="h-3 w-3" /> {profile.neighborhood}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {!editing ? (
            <div className="mt-4">
              {profile?.bio ? <p className="text-sm text-[#000305]">{profile.bio}</p> : <p className="text-sm text-[#01386A]/40 italic">Sem bio ainda</p>}
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5 border-[#01386A]/10 text-[#01386A] hover:bg-[#f7f75e]/20">
                  <Edit3 className="h-3.5 w-3.5" /> Editar perfil
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} /></div>
              <div className="space-y-1.5"><Label>Bio</Label><Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={300} /><span className="text-xs text-[#01386A]/40">{bio.length}/300</span></div>
              <div className="space-y-1.5">
                <Label>Bairro</Label>
                <select value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="flex h-10 w-full rounded-md border border-[#01386A]/10 bg-[#f7f9fa] px-3 py-2 text-sm">
                  <option value="">Nenhum</option>
                  {BAIRROS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} size="sm" className="bg-[#01386A] text-[#f7f9fa] hover:bg-[#01386A]/90 border-0">Salvar</Button>
                <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="border-[#01386A]/10 text-[#01386A]">Cancelar</Button>
              </div>
            </div>
          )}

          <div className="mt-6 flex gap-6">
            <div className="text-center"><p className="text-lg font-bold text-[#000305]">{postCount}</p><p className="text-xs text-[#01386A]/40">Posts</p></div>
            <div className="text-center"><p className="text-lg font-bold text-[#000305]">{followingCount}</p><p className="text-xs text-[#01386A]/40">Seguindo</p></div>
            <div className="text-center"><p className="text-lg font-bold text-[#000305]">{followersCount}</p><p className="text-xs text-[#01386A]/40">Seguidores</p></div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════ CAIXINHA DE POSTAR COM EDITOR ═══════ */}
      <div className="rounded-3xl bg-[#eef1f3] p-5 shadow-lg border border-[#0A4D5C]/8">
        <div className="flex items-start gap-3.5">
          <UserAvatar user={{ id: profile?.id || "", display_name: profile?.display_name || "?", avatar_url: profile?.avatar_url }} className="h-12 w-12 shrink-0" />
          <div className="flex-1 space-y-2.5">
            {/* Textarea com estilo visual */}
            <div
              className="rounded-2xl border border-[#0A4D5C]/10 overflow-hidden transition-all"
              style={{ backgroundColor: selectedColor.bg }}
            >
              <textarea
                placeholder="Escreva algo bonito..."
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, 500))}
                className="w-full min-h-[80px] resize-none border-0 bg-transparent p-3 text-sm focus:outline-none placeholder:opacity-40"
                style={{
                  color: selectedColor.text,
                  fontFamily: postStyle.font ? `'${postStyle.font}', sans-serif` : undefined,
                  fontWeight: postStyle.bold ? 700 : 400,
                  fontStyle: postStyle.italic ? "italic" : "normal",
                  textAlign: postStyle.alignment || "left",
                }}
                rows={3}
              />
            </div>

            {/* ═══════ TOOLBAR DO EDITOR ═══════ */}
            <div className="space-y-2">
              {/* Linha 1: Bold, Italic, Alinhamento, Fonte */}
              <div className="flex items-center gap-1 flex-wrap">
                {/* Bold */}
                <button
                  onClick={() => setPostStyle((s) => ({ ...s, bold: !s.bold }))}
                  className={`flex items-center justify-center rounded-lg h-8 w-8 text-xs transition-colors ${postStyle.bold ? "bg-[#0A4D5C] text-[#f7f9fa]" : "bg-[#0A4D5C]/[0.06] text-[#0A4D5C] hover:bg-[#0A4D5C]/10"}`}
                  title="Negrito"
                >
                  <Bold className="h-3.5 w-3.5" />
                </button>

                {/* Italic */}
                <button
                  onClick={() => setPostStyle((s) => ({ ...s, italic: !s.italic }))}
                  className={`flex items-center justify-center rounded-lg h-8 w-8 text-xs transition-colors ${postStyle.italic ? "bg-[#0A4D5C] text-[#f7f9fa]" : "bg-[#0A4D5C]/[0.06] text-[#0A4D5C] hover:bg-[#0A4D5C]/10"}`}
                  title="Itálico"
                >
                  <Italic className="h-3.5 w-3.5" />
                </button>

                <div className="w-px h-5 bg-[#0A4D5C]/10 mx-0.5" />

                {/* Alinhamento */}
                {([
                  { align: "left" as const, Icon: AlignLeft, label: "Esquerda" },
                  { align: "center" as const, Icon: AlignCenter, label: "Centro" },
                  { align: "right" as const, Icon: AlignRight, label: "Direita" },
                  { align: "justify" as const, Icon: AlignJustify, label: "Justificar" },
                ]).map(({ align, Icon, label }) => (
                  <button
                    key={align}
                    onClick={() => setPostStyle((s) => ({ ...s, alignment: align }))}
                    className={`flex items-center justify-center rounded-lg h-8 w-8 transition-colors ${postStyle.alignment === align ? "bg-[#0A4D5C] text-[#f7f9fa]" : "bg-[#0A4D5C]/[0.06] text-[#0A4D5C] hover:bg-[#0A4D5C]/10"}`}
                    title={label}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}

                <div className="w-px h-5 bg-[#0A4D5C]/10 mx-0.5" />

                {/* Seletor de fonte */}
                <div className="relative" ref={fontMenuRef}>
                  <button
                    onClick={() => setFontMenuOpen(!fontMenuOpen)}
                    className={`flex items-center gap-1 rounded-lg h-8 px-2.5 text-xs font-medium transition-colors ${fontMenuOpen ? "bg-[#0A4D5C] text-[#f7f9fa]" : "bg-[#0A4D5C]/[0.06] text-[#0A4D5C] hover:bg-[#0A4D5C]/10"}`}
                  >
                    <Type className="h-3.5 w-3.5" />
                    <span className="max-w-[60px] truncate">{postStyle.font || "Fonte"}</span>
                    <ChevronDown className={`h-3 w-3 transition-transform ${fontMenuOpen ? "rotate-180" : ""}`} />
                  </button>
                  {fontMenuOpen && (
                    <div className="absolute left-0 top-full mt-1 z-50 w-44 rounded-xl bg-[#f7f9fa] p-1.5 shadow-lg border border-[#0A4D5C]/10 animate-in fade-in-0 zoom-in-95 max-h-[240px] overflow-y-auto">
                      <button
                        onClick={() => { setPostStyle((s) => ({ ...s, font: null })); setFontMenuOpen(false); }}
                        className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-colors ${!postStyle.font ? "bg-[#0A4D5C] text-[#f7f9fa]" : "text-[#0A4D5C] hover:bg-[#0A4D5C]/10"}`}
                      >
                        Padrão
                      </button>
                      {FONTS.map((f) => (
                        <button
                          key={f.value}
                          onClick={() => { setPostStyle((s) => ({ ...s, font: f.value })); setFontMenuOpen(false); }}
                          className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-colors ${postStyle.font === f.value ? "bg-[#0A4D5C] text-[#f7f9fa]" : "text-[#0A4D5C] hover:bg-[#0A4D5C]/10"}`}
                          style={{ fontFamily: `'${f.value}', sans-serif` }}
                        >
                          {f.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Linha 2: Cores do post-it */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#0A4D5C]/40 mr-0.5">Cor:</span>
                {POST_IT_COLORS.map((color, i) => (
                  <button
                    key={i}
                    onClick={() => setPostStyle((s) => ({ ...s, postItColor: i }))}
                    className={`h-6 w-6 rounded-full border-2 transition-all hover:scale-110 ${postStyle.postItColor === i ? "border-[#0A4D5C] scale-110 shadow-md" : "border-transparent"}`}
                    style={{ backgroundColor: color.bg }}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            {/* ═══════ Contagem e botão publicar ═══════ */}
            <div className="flex items-center justify-between pt-1">
              {content.trim().length > 0 && (
                <span className={`text-[10px] ${content.length > 450 ? "text-red-500" : "text-[#0A4D5C]/30"}`}>
                  {content.length}/500
                </span>
              )}
              {content.trim().length === 0 && <span />}

              <button
                disabled={!content.trim() || publishing}
                onClick={handlePublish}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2EC4B6] text-[#f7f9fa] shadow-md hover:bg-[#25b0a3] active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
                title="Publicar"
              >
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-base">💬</span>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Configurações */}
      <Card className="cursor-pointer hover:bg-[#f7f75e]/10 transition-colors border-[#01386A]/8" onClick={() => setProfileSubView("settings")}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f7f75e]/30">
                <Settings className="h-4 w-4 text-[#01386A]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#000305]">Configurações</p>
                <p className="text-xs text-[#01386A]/40">Privacidade, seguidores e permissões</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {unreadNotifications > 0 && (
                <Badge variant="default" className="h-5 min-w-5 px-1.5 text-[10px] flex items-center justify-center bg-[#01386A] text-[#f7f9fa]">{unreadNotifications}</Badge>
              )}
              <span className="text-[#01386A]/30 text-sm">›</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Meus Posts */}
      {myPosts.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[#000305]">Meus posts</h3>
          <div className="space-y-2">
            {myPosts.map((post: any) => {
              const postStyleData: PostStyle | null = post.post_style;
              const hasStyle = postStyleData && Object.keys(postStyleData).length > 0;
              const isTextOnly = !post.image_urls?.length && !post.video_url && !post.audio_url;
              const colorIdx = postStyleData?.postItColor ?? 0;
              const postItColor = isTextOnly ? POST_IT_COLORS[colorIdx >= 0 && colorIdx < POST_IT_COLORS.length ? colorIdx : 0] : POST_IT_COLORS[0];

              return (
                <div
                  key={post.id}
                  className="rounded-lg p-3 transition-shadow hover:shadow-sm"
                  style={{
                    backgroundColor: isTextOnly ? postItColor.bg : "#f7f9fa",
                    border: isTextOnly ? `1px solid ${postItColor.border}` : "1px solid rgba(10,77,92,0.08)",
                    color: isTextOnly ? postItColor.text : "#000305",
                  }}
                >
                  <p
                    className="text-sm whitespace-pre-wrap"
                    style={{
                      fontFamily: postStyleData?.font ? `'${postStyleData.font}', sans-serif` : isTextOnly ? "serif" : undefined,
                      fontWeight: postStyleData?.bold ? 700 : undefined,
                      fontStyle: postStyleData?.italic ? "italic" : undefined,
                      textAlign: postStyleData?.alignment || undefined,
                    }}
                  >
                    {post.content}
                  </p>
                  <div className="mt-1 flex items-center gap-2" style={{ color: isTextOnly ? `${postItColor.text}80` : "rgba(1,56,106,0.4)" }}>
                    <span className="text-[10px]">{timeAgo(post.created_at)}</span>
                    {post.neighborhood && <span className="text-[10px]">· {post.neighborhood}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Button variant="destructive" onClick={handleLogout} className="w-full gap-2">
        <LogOut className="h-4 w-4" /> Sair da conta
      </Button>
    </div>
  );
}
