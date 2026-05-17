"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef, useCallback } from "react";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Send, ArrowLeft, Users, Plus, LogOut, UserPlus, UserCheck,
  ChevronDown, ChevronUp, X, MoreVertical, Hash, Crown,
  ImagePlus, Video, Mic, Play, Pause, Volume2, Loader2, Music,
} from "lucide-react";
import { getInitials, getAvatarColor, timeAgo } from "@/lib/constants";
import { UserAvatar } from "./UserAvatar";
import { useRealtimeMessages } from "@/hooks/use-realtime";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  compressImage,
  validateImageFile,
  createPreviewUrl,
  revokePreviewUrl,
} from "@/lib/image-compression";

const ROOM_ICONS = [
  "💬", "🏠", "🎮", "⚽", "🎵", "📸", "🎬", "📚",
  "🍕", "💡", "🔧", "🎯", "🌟", "🚀", "❤️", "🔥",
  "🎨", "💻", "🐶", "🌈", "☕", "🛒", "📣", "🤝",
];

// ═══════════════════════════════════════════════════════════
// ChatAudioPlayer — audio player with duration bar for chat
// ═══════════════════════════════════════════════════════════
function ChatAudioPlayer({ src, isMine }: { src: string; isMine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const durationFetched = useRef(false);

  const formatTime = (s: number) => {
    if (!s || !isFinite(s) || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
    setPlaying(!playing);
  };

  const trySetDuration = (d: number | undefined | null) => {
    if (d && isFinite(d) && !isNaN(d) && d > 0 && !durationFetched.current) {
      setDuration(d);
      durationFetched.current = true;
    }
  };

  // Robust duration detection — same approach as FeedView AudioPlayer
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || durationFetched.current) return;

    // Try immediately
    const d = audio.duration;
    if (isFinite(d) && !isNaN(d) && d > 0) {
      setDuration(d);
      durationFetched.current = true;
      return;
    }

    const onMeta = () => { trySetDuration(audio.duration); };
    const onDurChange = () => { trySetDuration(audio.duration); };

    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onDurChange);

    // Force load
    audio.load();

    // Fallback timer for WebM/Opus (needs full download)
    const timer = setTimeout(() => { trySetDuration(audio.duration); }, 3000);

    return () => {
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onDurChange);
      clearTimeout(timer);
    };
  }, []);

  // displayDuration is always safe — never Infinity or NaN
  const displayDuration = duration > 0 && isFinite(duration) && !isNaN(duration) ? duration : 0;
  const durationLabel = displayDuration > 0 ? `${Math.round(displayDuration)}s` : "";

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    if (audioRef.current && displayDuration > 0) {
      audioRef.current.currentTime = pct * displayDuration;
    }
  };

  const progressPct = displayDuration > 0 ? (currentTime / displayDuration) * 100 : 0;

  return (
    <div className="rounded-xl mt-1 p-3" style={{ backgroundColor: isMine ? "rgba(10,77,92,0.08)" : "rgba(10,77,92,0.04)" }}>
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105"
          style={{ backgroundColor: "#0A4D5C" }}
        >
          {playing ? <Pause className="h-4 w-4" style={{ color: "#f7f9fa" }} /> : <Play className="h-4 w-4 ml-0.5" style={{ color: "#f7f9fa" }} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Music className="h-3 w-3" style={{ color: "#0A4D5C", opacity: 0.5 }} />
            {durationLabel && <span className="text-[10px] font-semibold" style={{ color: "#2EC4B6" }}>{durationLabel}</span>}
            <span className="text-[10px] font-semibold tabular-nums" style={{ color: "#000305", opacity: 0.7 }}>{formatTime(currentTime)}</span>
            <span className="text-[9px]" style={{ color: "#0A4D5C", opacity: 0.25 }}>/</span>
            <span className="text-[10px] tabular-nums" style={{ color: "#0A4D5C", opacity: 0.4 }}>{formatTime(displayDuration)}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden cursor-pointer" style={{ backgroundColor: "rgba(10,77,92,0.12)" }} onClick={handleSeek}>
            <div className="h-full rounded-full transition-all duration-150" style={{ width: `${progressPct}%`, backgroundColor: "#0A4D5C" }} />
          </div>
        </div>
      </div>
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        onTimeUpdate={() => {
          const t = audioRef.current?.currentTime || 0;
          setCurrentTime(isFinite(t) && !isNaN(t) ? t : 0);
        }}
        onLoadedMetadata={() => trySetDuration(audioRef.current?.duration)}
        onDurationChange={() => trySetDuration(audioRef.current?.duration)}
        onEnded={() => setPlaying(false)}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ChatVideoPlayer — compact video player for chat bubbles
// ═══════════════════════════════════════════════════════════
function ChatVideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = () => {
    if (!videoRef.current) return;
    if (playing) videoRef.current.pause();
    else videoRef.current.play();
    setPlaying(!playing);
  };

  const formatTime = (s: number) => {
    if (!s || !isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="mt-1 relative rounded-xl overflow-hidden bg-black group">
      <video
        ref={videoRef}
        src={src}
        className="w-full max-h-64 object-contain"
        playsInline
        preload="metadata"
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
        onEnded={() => setPlaying(false)}
        onClick={toggle}
      />
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer" onClick={toggle}>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-md shadow-lg">
            <Play className="h-6 w-6 text-white fill-white ml-0.5" />
          </div>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-1.5">
          <button onClick={toggle} className="text-white">
            {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </button>
          <div className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden cursor-pointer" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            if (videoRef.current && duration) videoRef.current.currentTime = pct * duration;
          }}>
            <div className="h-full bg-white rounded-full" style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }} />
          </div>
          <span className="text-[9px] text-white/80 tabular-nums">{formatTime(currentTime)}/{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ChatImageViewer — fullscreen image viewer
// ═══════════════════════════════════════════════════════════
function ChatImageViewer({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
        <X className="h-5 w-5" />
      </button>
      <img src={src} alt="Imagem" className="max-h-[90vh] max-w-[95vw] object-contain" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MessageContent — renders a message bubble with media
// ═══════════════════════════════════════════════════════════
function MessageContent({ msg, isMine, onImageClick }: { msg: any; isMine: boolean; onImageClick?: (url: string) => void }) {
  const hasMedia = !!msg.media_url;
  const hasText = !!msg.content;
  const mediaType = msg.media_type;

  return (
    <>
      {/* Photo */}
      {hasMedia && mediaType === "image" && (
        <button
          onClick={() => onImageClick?.(msg.media_url)}
          className="mt-1 w-full overflow-hidden rounded-xl"
        >
          <img
            src={msg.media_url}
            alt="Foto"
            className="w-full max-h-72 object-cover hover:opacity-95 transition-opacity rounded-xl"
            loading="lazy"
          />
        </button>
      )}

      {/* Video */}
      {hasMedia && mediaType === "video" && (
        <ChatVideoPlayer src={msg.media_url} />
      )}

      {/* Audio */}
      {hasMedia && mediaType === "audio" && (
        <ChatAudioPlayer src={msg.media_url} isMine={isMine} />
      )}

      {/* Text content */}
      {hasText && <span>{msg.content}</span>}

      {/* Media-only indicator if no text */}
      {hasMedia && !hasText && mediaType === "image" && (
        <span className="text-xs opacity-70 mt-1 block">Foto</span>
      )}
      {hasMedia && !hasText && mediaType === "video" && (
        <span className="text-xs opacity-70 mt-1 block">Vídeo</span>
      )}
    </>
  );
}

export function RoomsView({ openUserProfile }: { openUserProfile?: (userId: string) => void }) {
  const { profile, selectedRoom, setSelectedRoom } = useStore();
  const navigateToProfile = (uid: string) => {
    if (openUserProfile) {
      openUserProfile(uid);
    } else {
      window.dispatchEvent(new CustomEvent("openUserProfile", { detail: { userId: uid } }));
    }
  };
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch("/api/rooms");
      const data = await res.json();
      setRooms(data.rooms || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  if (selectedRoom) return <RoomChat room={selectedRoom} onBack={() => setSelectedRoom(null)} onRefreshRooms={fetchRooms} openUserProfile={navigateToProfile} />;

  if (loading) return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-20 rounded-2xl bg-muted/50 animate-pulse" />
      ))}
    </div>
  );

  const official = rooms.filter((r) => r.type === "official");
  const community = rooms.filter((r) => r.type === "community");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Salas</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{rooms.length} salas ativas</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5 rounded-full px-4 shadow-sm">
          <Plus className="h-4 w-4" /> Nova sala
        </Button>
      </div>

      <div>
        <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">Oficiais</h3>
        <div className="space-y-1.5">
          {official.map((room) => (
            <RoomCard key={room.id} room={room} onClick={() => setSelectedRoom(room)} />
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">Comunidades</h3>
        <div className="space-y-1.5">
          {community.map((room) => (
            <RoomCard key={room.id} room={room} onClick={() => setSelectedRoom(room)} />
          ))}
          {community.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                <Hash className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Nenhuma comunidade ainda</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Crie a primeira!</p>
            </div>
          )}
        </div>
      </div>

      <CreateRoomDialog open={showCreate} onOpenChange={setShowCreate} onCreated={(room) => {
        setSelectedRoom(room);
        fetchRooms();
      }} />
    </div>
  );
}

function RoomCard({ room, onClick }: { room: any; onClick: () => void }) {
  const memberCount = room.memberCount || room.member_count || room._count?.members || 0;
  const isOfficial = room.type === "official";
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3.5 rounded-2xl bg-card px-4 py-3.5 text-left transition-all duration-200 hover:bg-accent hover:shadow-sm active:scale-[0.98] border border-transparent hover:border-border/50"
    >
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-xl shrink-0 transition-transform group-hover:scale-105 ${
        isOfficial
          ? "bg-primary/10 text-primary"
          : "bg-secondary"
      }`}>
        {room.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold truncate">{room.name}</span>
          {isOfficial && <Crown className="h-3 w-3 text-primary shrink-0" />}
        </div>
        {room.description ? (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{room.description}</p>
        ) : (
          <p className="text-xs text-muted-foreground/60 mt-0.5">{memberCount} membro{memberCount !== 1 ? "s" : ""}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted/80">
          <Users className="h-3 w-3" />
        </div>
        <span className="font-medium tabular-nums">{memberCount}</span>
      </div>
    </button>
  );
}

function CreateRoomDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (room: any) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("💬");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Nome da sala é obrigatório");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), icon }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
      toast.success(`Sala "${data.room.name}" criada!`);
      onCreated(data.room);
      onOpenChange(false);
      setName("");
      setDescription("");
      setIcon("💬");
    } catch {
      toast.error("Erro ao criar sala");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg">Criar nova sala</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Ícone da sala</Label>
            <div className="flex flex-wrap gap-1.5">
              {ROOM_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setIcon(emoji)}
                  className={`h-10 w-10 rounded-xl text-lg flex items-center justify-center transition-all duration-150 ${
                    icon === emoji
                      ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 scale-110"
                      : "bg-muted hover:bg-accent hover:scale-105"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Nome da sala</Label>
            <Input placeholder="Ex: Bate-papo do Centro" value={name} onChange={(e) => setName(e.target.value.slice(0, 50))} maxLength={50} className="h-11 rounded-xl" />
            <span className="text-[10px] text-muted-foreground">{name.length}/50</span>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Descrição (opcional)</Label>
            <Input placeholder="Do que essa sala é sobre?" value={description} onChange={(e) => setDescription(e.target.value.slice(0, 200))} maxLength={200} className="h-11 rounded-xl" />
            <span className="text-[10px] text-muted-foreground">{description.length}/200</span>
          </div>
          <Button onClick={handleCreate} disabled={loading || !name.trim()} className="w-full h-11 rounded-xl">
            {loading ? "Criando..." : "Criar sala"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════
// RoomChat — com envio real de mídia (foto, vídeo, áudio)
// ═══════════════════════════════════════════════════════════
function RoomChat({ room, onBack, onRefreshRooms, openUserProfile }: { room: any; onBack: () => void; onRefreshRooms: () => void; openUserProfile?: (userId: string) => void }) {
  const { profile } = useStore();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [sending, setSending] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Media state
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [imageViewerSrc, setImageViewerSrc] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const fetchMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/rooms/${room.id}/members`);
      const data = await res.json();
      if (data.members && data.members.length > 0) {
        setMembers(data.members);
        setMembersLoading(false);
        return;
      }

      const supabase = createClient();
      const { data: rawMembers, error: rmErr } = await supabase
        .from("room_members")
        .select("id, user_id, created_at")
        .eq("room_id", room.id);

      if (!rmErr && rawMembers && rawMembers.length > 0) {
        const userIds = rawMembers.map((m: any) => m.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url, neighborhood")
          .in("id", userIds);

        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
        const enriched = rawMembers.map((m: any) => ({
          id: m.id,
          user_id: m.user_id,
          joined_at: m.created_at,
          profile: profileMap.get(m.user_id) || null,
        }));

        setMembers(enriched);
        setMembersLoading(false);
        return;
      }

      if (profile) {
        const isAlreadyInList = members.some((m: any) => m.user_id === profile.id);
        if (!isAlreadyInList) {
          setMembers([{
            id: "self",
            user_id: profile.id,
            joined_at: new Date().toISOString(),
            profile: { id: profile.id, display_name: profile.display_name, username: profile.username, avatar_url: profile.avatar_url, neighborhood: profile.neighborhood }
          }]);
        }
      }
    } catch (err) {
      if (profile) {
        setMembers([{
          id: "self",
          user_id: profile.id,
          joined_at: new Date().toISOString(),
          profile: { id: profile.id, display_name: profile.display_name, username: profile.username, avatar_url: profile.avatar_url, neighborhood: profile.neighborhood }
        }]);
      }
    }
    setMembersLoading(false);
  }, [room.id, profile]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${room.id}/messages?limit=50`);
      const data = await res.json();
      if (data.error) return;
      setMessages(data.messages || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [room.id]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  useEffect(() => {
    const check = async () => {
      if (!profile) return;
      const supabase = createClient();
      const { data } = await supabase
        .from("room_members")
        .select("id")
        .eq("room_id", room.id)
        .eq("user_id", profile.id)
        .maybeSingle();
      setIsMember(!!data);
    };
    check();
  }, [room.id, profile]);

  const handleNewMessage = useCallback((payload: any) => {
    const fetchSender = async () => {
      const supabase = createClient();
      const { data: sender } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .eq("id", payload.sender_id)
        .single();
      const newMsg = { ...payload, sender: sender || { id: payload.sender_id, display_name: "Usuário", username: "" } };
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    };
    fetchSender();
  }, []);

  useRealtimeMessages({
    table: "messages",
    filter: `room_id=eq.${room.id}`,
    onInsert: handleNewMessage,
    enabled: !!profile && isMember,
  });

  const handleMemberJoin = useCallback((payload: any) => {
    const fetchProf = async () => {
      const supabase = createClient();
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, neighborhood")
        .eq("id", payload.user_id)
        .single();
      if (prof) {
        setMembers((prev) => {
          if (prev.some((m) => m.user_id === payload.user_id)) return prev;
          return [...prev, { id: payload.id, user_id: payload.user_id, joined_at: payload.created_at, profile: prof }];
        });
      }
    };
    fetchProf();
  }, []);

  const handleMemberLeave = useCallback((payload: any) => {
    setMembers((prev) => prev.filter((m) => m.user_id !== payload.user_id));
  }, []);

  useRealtimeMessages({
    table: "room_members",
    filter: `room_id=eq.${room.id}`,
    onInsert: handleMemberJoin,
    onDelete: handleMemberLeave,
    enabled: !!profile,
  });

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 100);
  }, [messages, loading]);

  const handleJoin = async () => {
    try {
      const res = await fetch(`/api/rooms/${room.id}/join`, { method: "POST" });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
      if (data.joined) {
        setIsMember(true);
        toast.success("Você entrou na sala!");
        fetchMembers();
        onRefreshRooms();
      }
    } catch {
      toast.error("Erro ao entrar na sala");
    }
  };

  const handleLeave = async () => {
    try {
      const res = await fetch(`/api/rooms/${room.id}/leave`, { method: "POST" });
      const data = await res.json();
      if (data.left) {
        setIsMember(false);
        toast.success("Você saiu da sala");
        onRefreshRooms();
        onBack();
      }
    } catch {
      toast.error("Erro ao sair da sala");
    }
  };

  useEffect(() => {
    if (showMembers) fetchMembers();
  }, [showMembers, fetchMembers]);

  const clearMedia = () => {
    if (photoPreview) revokePreviewUrl(photoPreview);
    setSelectedPhoto(null);
    setPhotoPreview(null);
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setSelectedVideo(null);
    setVideoPreview(null);
    if (audioPreview) URL.revokeObjectURL(audioPreview);
    setSelectedAudio(null);
    setAudioPreview(null);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const error = validateImageFile(file);
    if (error) { toast.error(error); return; }
    clearMedia();
    setSelectedPhoto(file);
    setPhotoPreview(createPreviewUrl(file));
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["video/mp4", "video/webm", "video/quicktime"].includes(file.type)) {
      toast.error("Tipo não suportado. Use MP4, WebM ou MOV.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Vídeo muito grande (máx 50MB)");
      return;
    }
    clearMedia();
    setSelectedVideo(file);
    setVideoPreview(URL.createObjectURL(file));
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg", "audio/wav", "audio/x-m4a"].includes(file.type)) {
      toast.error("Tipo não suportado. Use MP3, M4A, WebM, OGG ou WAV.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Áudio muito grande (máx 10MB)");
      return;
    }
    clearMedia();
    setSelectedAudio(file);
    setAudioPreview(URL.createObjectURL(file));
    if (audioInputRef.current) audioInputRef.current.value = "";
  };

  const uploadPhoto = async (file: File): Promise<string | null> => {
    try {
      const compressed = await compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.55, maxSizeKB: 150 });
      const formData = new FormData();
      formData.append("file", compressed, "photo.webp");
      formData.append("folder", "chat");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) return data.url;
      toast.error(data.error || "Erro ao enviar foto");
      return null;
    } catch { toast.error("Erro ao processar foto"); return null; }
  };

  const uploadVideo = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "chat");
      const res = await fetch("/api/upload/video", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) return data.url;
      toast.error(data.error || "Erro ao enviar vídeo");
      return null;
    } catch { toast.error("Erro ao enviar vídeo"); return null; }
  };

  const uploadAudio = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "chat");
      const res = await fetch("/api/upload/audio", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) return data.url;
      toast.error(data.error || "Erro ao enviar áudio");
      return null;
    } catch { toast.error("Erro ao enviar áudio"); return null; }
  };

  const sendMessage = async () => {
    if (!profile || !isMember) return;
    const hasText = input.trim().length > 0;
    const hasMedia = selectedPhoto || selectedVideo || selectedAudio;
    if (!hasText && !hasMedia) return;

    setSending(true);
    try {
      let mediaUrl: string | null = null;
      let mediaType: string | null = null;

      if (selectedPhoto) {
        mediaUrl = await uploadPhoto(selectedPhoto);
        mediaType = "image";
      } else if (selectedVideo) {
        mediaUrl = await uploadVideo(selectedVideo);
        mediaType = "video";
      } else if (selectedAudio) {
        mediaUrl = await uploadAudio(selectedAudio);
        mediaType = "audio";
      }

      if (hasMedia && !mediaUrl) {
        setSending(false);
        return;
      }

      const body: any = {};
      if (hasText) body.content = input.trim();
      if (mediaUrl) {
        body.media_url = mediaUrl;
        body.media_type = mediaType;
      }

      const res = await fetch(`/api/rooms/${room.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        setSending(false);
        return;
      }
      if (data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
      setInput("");
      clearMedia();
    } catch { toast.error("Erro ao enviar mensagem"); }
    setSending(false);
  };

  const memberCount = members.length || room.memberCount || room.member_count || 0;

  const groupedMessages = messages.map((msg, idx) => {
    const prev = idx > 0 ? messages[idx - 1] : null;
    const isGrouped = prev && prev.sender_id === msg.sender_id;
    return { ...msg, isGrouped };
  });

  const hasAnyMedia = selectedPhoto || selectedVideo || selectedAudio;
  const canSend = input.trim() || hasAnyMedia;

  return (
    <div className="flex h-full flex-col -mx-4 -mt-4 md:-mx-0 md:-mt-0">
      <div className="flex items-center gap-3 border-b px-4 py-3 bg-card/80 backdrop-blur-md sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 rounded-full hover:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${room.type === "official" ? "bg-primary/10" : "bg-secondary"}`}>
          <span className="text-lg">{room.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold truncate">{room.name}</h3>
            {room.type === "official" && <Crown className="h-3 w-3 text-primary shrink-0" />}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {memberCount} membro{memberCount !== 1 ? "s" : ""}
            {room.description ? ` · ${room.description}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMembers(!showMembers)}
            className="gap-1.5 text-xs rounded-full px-3"
          >
            <Users className="h-4 w-4" />
            <span className="font-medium">{memberCount}</span>
          </Button>
          {isMember && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleLeave} className="text-destructive focus:text-destructive gap-2">
                  <LogOut className="h-4 w-4" /> Sair da sala
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {showMembers && (
        <div className="border-b bg-card/50 backdrop-blur-md px-4 py-3 max-h-56 overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">
              Membros · {members.length}
            </h4>
            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => setShowMembers(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          {membersLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-9 rounded-lg bg-muted/50 animate-pulse" />)}
            </div>
          ) : members.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Nenhum membro ainda</p>
          ) : (
            <div className="grid grid-cols-2 gap-1">
              {members.map((m: any) => {
                const mp = m.profile;
                if (!mp) {
                  return (
                    <div key={m.id || m.user_id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent/50 transition-colors">
                      <UserAvatar user={{ id: m.user_id || "unknown", display_name: "?" }} className="h-7 w-7" />
                      <span className="text-xs font-medium text-muted-foreground truncate">Usuário</span>
                    </div>
                  );
                }
                return (
                  <div key={m.id || m.user_id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => openUserProfile?.(mp.id)}>
                    <UserAvatar user={{ id: mp.id, display_name: mp.display_name, avatar_url: mp.avatar_url }} className="h-7 w-7" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium truncate">{mp.display_name}</span>
                        {m.user_id === profile?.id && (
                          <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3.5 shrink-0">Você</Badge>
                        )}
                      </div>
                      {mp.neighborhood && <span className="text-[10px] text-muted-foreground truncate block">{mp.neighborhood}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!isMember && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-xs">
            <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${room.type === "official" ? "bg-primary/10" : "bg-secondary"}`}>
              <span className="text-2xl">{room.icon}</span>
            </div>
            <h3 className="text-base font-bold mb-1">{room.name}</h3>
            {room.description && <p className="text-sm text-muted-foreground mb-1">{room.description}</p>}
            <p className="text-xs text-muted-foreground/60 mb-5">{memberCount} membro{memberCount !== 1 ? "s" : ""} nesta sala</p>
            <Button onClick={handleJoin} className="gap-2 rounded-full px-6 shadow-sm">
              <UserPlus className="h-4 w-4" /> Entrar na sala
            </Button>
          </div>
        </div>
      )}

      {isMember && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1" style={{ maxHeight: "calc(100vh - 320px)" }}>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-xs text-muted-foreground">Carregando mensagens...</span>
              </div>
            </div>
          )}
          {!loading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
                <Hash className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Nenhuma mensagem ainda</p>
              <p className="text-xs text-muted-foreground mt-0.5">Seja o primeiro a dizer algo!</p>
            </div>
          )}
          {groupedMessages.map((msg, idx) => {
            const isMine = msg.sender_id === profile?.id;
            const sender = msg.sender || {};
            const showAvatar = !isMine && !msg.isGrouped;
            const showName = !isMine && !msg.isGrouped;

            return (
              <div key={msg.id} className={`flex gap-2.5 ${msg.isGrouped ? (isMine ? "pl-0 pr-0" : "pl-[38px]") : ""} ${isMine ? "justify-end" : ""}`}>
                {!isMine && showAvatar && (
                  <button onClick={() => openUserProfile?.(sender.id || msg.sender_id)} className="shrink-0">
                    <UserAvatar
                      user={{ id: sender.id || msg.sender_id, display_name: sender.display_name || "Usuário", avatar_url: sender.avatar_url }}
                      className="h-7 w-7 mt-0.5 hover:opacity-80 transition-opacity"
                    />
                  </button>
                )}

                <div className={`max-w-[80%] ${isMine ? "items-end" : "items-start"}`}>
                  {showName && (
                    <button
                      onClick={() => openUserProfile?.(sender.id || msg.sender_id)}
                      className="text-[11px] font-semibold text-muted-foreground mb-0.5 block hover:underline underline-offset-2 transition-all"
                    >
                      {sender.display_name || "Usuário"}
                    </button>
                  )}

                  <div className="flex items-end gap-1.5">
                    {isMine && (
                      <span className="text-[9px] text-muted-foreground/50 mb-1 shrink-0">{timeAgo(msg.created_at)}</span>
                    )}
                    <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed inline-block break-words overflow-hidden ${
                      isMine
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted rounded-bl-md"
                    }`}>
                      <MessageContent msg={msg} isMine={isMine} onImageClick={(url) => setImageViewerSrc(url)} />
                    </div>
                    {!isMine && (
                      <span className="text-[9px] text-muted-foreground/50 mb-1 shrink-0">{timeAgo(msg.created_at)}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Media previews */}
      {isMember && hasAnyMedia && (
        <div className="px-4 py-2 border-t bg-card/80">
          <div className="flex items-center gap-2">
            {selectedPhoto && photoPreview && (
              <div className="relative">
                <img src={photoPreview} alt="Preview" className="h-16 w-16 rounded-lg object-cover border" />
                <button onClick={() => { setSelectedPhoto(null); if (photoPreview) revokePreviewUrl(photoPreview); setPhotoPreview(null); }} className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {selectedVideo && videoPreview && (
              <div className="relative">
                <video src={videoPreview} className="h-16 w-24 rounded-lg object-cover border" playsInline muted />
                <button onClick={() => { setSelectedVideo(null); if (videoPreview) URL.revokeObjectURL(videoPreview); setVideoPreview(null); }} className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {selectedAudio && audioPreview && (
              <div className="relative flex items-center gap-2 rounded-lg border bg-primary/5 px-3 py-2">
                <Mic className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium">Áudio</span>
                <button onClick={() => { setSelectedAudio(null); if (audioPreview) URL.revokeObjectURL(audioPreview); setAudioPreview(null); }} className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="border-t px-4 py-3 bg-card/80 backdrop-blur-md">
        {isMember ? (
          <div className="flex items-center gap-2">
            {/* Media buttons */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={!!selectedVideo || !!selectedAudio}
                className={`flex items-center justify-center h-9 w-9 rounded-full transition-colors ${!selectedVideo && !selectedAudio ? "text-primary hover:bg-primary/10" : "text-muted-foreground/40 cursor-not-allowed"}`}
                title="Enviar foto"
              >
                <ImagePlus className="h-4.5 w-4.5" />
              </button>
              <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handlePhotoSelect} className="hidden" />

              <button
                onClick={() => videoInputRef.current?.click()}
                disabled={!!selectedPhoto || !!selectedAudio || !!selectedVideo}
                className={`flex items-center justify-center h-9 w-9 rounded-full transition-colors ${!selectedPhoto && !selectedAudio && !selectedVideo ? "text-primary hover:bg-primary/10" : "text-muted-foreground/40 cursor-not-allowed"}`}
                title="Enviar vídeo"
              >
                <Video className="h-4.5 w-4.5" />
              </button>
              <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" onChange={handleVideoSelect} className="hidden" />

              <button
                onClick={() => audioInputRef.current?.click()}
                disabled={!!selectedPhoto || !!selectedVideo || !!selectedAudio}
                className={`flex items-center justify-center h-9 w-9 rounded-full transition-colors ${!selectedPhoto && !selectedVideo && !selectedAudio ? "text-primary hover:bg-primary/10" : "text-muted-foreground/40 cursor-not-allowed"}`}
                title="Enviar áudio"
              >
                <Mic className="h-4.5 w-4.5" />
              </button>
              <input ref={audioInputRef} type="file" accept="audio/mpeg,audio/mp4,audio/webm,audio/ogg,audio/wav,audio/x-m4a" onChange={handleAudioSelect} className="hidden" />
            </div>

            <div className="flex-1 relative">
              <Input
                placeholder="Escreva uma mensagem..."
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, 2000))}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && canSend && sendMessage()}
                className="h-11 rounded-full pl-4 pr-4 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/30"
              />
            </div>
            <Button
              size="icon"
              onClick={sendMessage}
              disabled={!canSend || sending}
              className="h-11 w-11 rounded-full shrink-0 shadow-sm transition-all hover:shadow-md disabled:shadow-none"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        ) : (
          <Button onClick={handleJoin} className="w-full h-11 rounded-full gap-2 shadow-sm">
            <UserCheck className="h-4 w-4" /> Entrar na sala
          </Button>
        )}
      </div>

      {/* Image viewer overlay */}
      {imageViewerSrc && (
        <ChatImageViewer src={imageViewerSrc} onClose={() => setImageViewerSrc(null)} />
      )}
    </div>
  );
}
