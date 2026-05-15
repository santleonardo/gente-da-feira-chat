"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useStore, Profile } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Heart,
  MapPin,
  MessageCircle,
  Trash2,
  Send,
  ChevronDown,
  ChevronUp,
  Reply,
  ImagePlus,
  Video,
  Mic,
  X,
  Clock,
  Loader2,
  Share2,
  Globe,
  Users as UsersIcon,
  Play,
  Pause,
  Volume2,
  Repeat2,
  Copy,
  ExternalLink,
  Camera,
  Plus,
  Square,
  Music,
} from "lucide-react";
import { getInitials, getAvatarColor, timeAgo } from "@/lib/constants";
import { UserAvatar } from "./UserAvatar";
import { toast } from "sonner";
import {
  compressImage,
  validateImageFile,
  createPreviewUrl,
  revokePreviewUrl,
} from "@/lib/image-compression";

// ═══════════════════════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════════════════════
const MAX_PHOTOS_PER_POST = 5;
const MAX_ACTIVE_MEDIA_POSTS = 5;
const MAX_VIDEO_POSTS_PER_12H = 5;
const MAX_VIDEO_DURATION = 30;
const MAX_AUDIO_DURATION = 60;

const REACTION_EMOJIS = [
  { type: "like", emoji: "\u2764\uFE0F", label: "Curtir" },
  { type: "laugh", emoji: "\uD83D\uDE02", label: "Engra\u00E7ado" },
  { type: "sad", emoji: "\uD83D\uDE14", label: "Triste" },
  { type: "wow", emoji: "\uD83D\uDE32", label: "Uau" },
  { type: "angry", emoji: "\uD83D\uDE21", label: "Bravo" },
  { type: "love", emoji: "\uD83D\uDE0D", label: "Amei" },
] as const;

function buildReactionGroups(reactions: { user_id: string; type: string }[]) {
  const groups: Record<string, { emoji: string; count: number; types: string[] }> = {};
  for (const r of reactions) {
    const match = REACTION_EMOJIS.find((e) => e.type === r.type);
    const emoji = match?.emoji || "\u2764\uFE0F";
    if (!groups[r.type]) groups[r.type] = { emoji, count: 0, types: [r.type] };
    groups[r.type].count++;
  }
  return Object.values(groups);
}

function getExpirationLabel(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expirado";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h${m > 0 ? `${m}min` : ""}`;
  return `${m}min`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ═══════════════════════════════════════════════════════════
// Interfaces
// ═══════════════════════════════════════════════════════════
interface Comment {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  parent_id?: string | null;
  author: { id: string; display_name: string; username: string; avatar_url?: string | null; neighborhood?: string | null };
  reactions: { user_id: string; type: string }[];
}

interface PostWithAuthor {
  id: string;
  content: string;
  neighborhood?: string | null;
  created_at: string;
  author_id: string;
  comment_count?: number;
  image_urls?: string[];
  video_url?: string | null;
  audio_url?: string | null;
  expires_at?: string | null;
  visibility?: "public" | "followers";
  shared_post_id?: string | null;
  shared_post?: PostWithAuthor | null;
  author: { id: string; display_name: string; username: string; avatar_url?: string | null; neighborhood?: string | null };
  reactions: { user_id: string; type: string }[];
}

// ═══════════════════════════════════════════════════════════
// VideoPlayer
// ═══════════════════════════════════════════════════════════
function VideoPlayer({ src }: { src: string }) {
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

  return (
    <div className="relative rounded-xl overflow-hidden bg-black group">
      <video
        ref={videoRef}
        src={src}
        className="w-full max-h-80 object-contain"
        playsInline
        preload="metadata"
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
        onEnded={() => setPlaying(false)}
        onClick={toggle}
      />
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer" onClick={toggle}>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm transition-transform hover:scale-110">
            <Play className="h-6 w-6 text-white fill-white ml-0.5" />
          </div>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-6 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="text-white">
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <div className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden cursor-pointer" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            if (videoRef.current && duration) videoRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
          }}>
            <div className="h-full bg-white rounded-full transition-all" style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }} />
          </div>
          <span className="text-[9px] text-white/70 tabular-nums">{formatDuration(currentTime)}/{formatDuration(duration)}</span>
        </div>
      </div>
      <div className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-black/50 backdrop-blur-sm px-1.5 py-0.5 text-[9px] text-white/80">
        <Video className="h-2.5 w-2.5" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// AudioPlayer
// ═══════════════════════════════════════════════════════════
function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
    setPlaying(!playing);
  };

  return (
    <div className="flex items-center gap-3 rounded-lg bg-primary/5 border border-primary/10 p-3">
      <button onClick={toggle} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <Volume2 className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-medium">Áudio</span>
          <span className="text-[10px] text-muted-foreground tabular-nums">{formatDuration(currentTime)} / {formatDuration(duration)}</span>
        </div>
        <div className="h-1.5 bg-primary/15 rounded-full overflow-hidden cursor-pointer" onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          if (audioRef.current && duration) audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
        }}>
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }} />
        </div>
      </div>
      <audio ref={audioRef} src={src} preload="metadata" onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)} onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)} onEnded={() => setPlaying(false)} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PhotoGrid
// ═══════════════════════════════════════════════════════════
function PhotoGrid({ photos, onPhotoClick }: { photos: string[]; onPhotoClick?: (index: number) => void }) {
  const count = photos.length;
  if (count === 0) return null;

  if (count === 1) {
    return (
      <button onClick={() => onPhotoClick?.(0)} className="w-full overflow-hidden rounded-xl">
        <img src={photos[0]} alt="Foto do post" className="w-full max-h-72 object-cover hover:opacity-95 transition-opacity" loading="lazy" />
      </button>
    );
  }
  if (count === 2) {
    return (
      <div className="grid grid-cols-2 gap-0.5 overflow-hidden rounded-xl">
        {photos.map((url, i) => (
          <button key={i} onClick={() => onPhotoClick?.(i)} className="overflow-hidden">
            <img src={url} alt={`Foto ${i + 1}`} className="w-full h-36 object-cover hover:opacity-95 transition-opacity" loading="lazy" />
          </button>
        ))}
      </div>
    );
  }
  if (count === 3) {
    return (
      <div className="grid grid-cols-2 gap-0.5 overflow-hidden rounded-xl">
        <button onClick={() => onPhotoClick?.(0)} className="row-span-2 overflow-hidden">
          <img src={photos[0]} alt="Foto 1" className="w-full h-full object-cover hover:opacity-95 transition-opacity" loading="lazy" />
        </button>
        <button onClick={() => onPhotoClick?.(1)} className="overflow-hidden">
          <img src={photos[1]} alt="Foto 2" className="w-full h-36 object-cover hover:opacity-95 transition-opacity" loading="lazy" />
        </button>
        <button onClick={() => onPhotoClick?.(2)} className="overflow-hidden">
          <img src={photos[2]} alt="Foto 3" className="w-full h-36 object-cover hover:opacity-95 transition-opacity" loading="lazy" />
        </button>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-0.5 overflow-hidden rounded-xl">
      {photos.slice(0, 4).map((url, i) => (
        <button key={i} onClick={() => onPhotoClick?.(i)} className="relative overflow-hidden">
          <img src={url} alt={`Foto ${i + 1}`} className="w-full h-36 object-cover hover:opacity-95 transition-opacity" loading="lazy" />
          {i === 3 && count > 4 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white font-semibold text-sm">+{count - 4}</div>
          )}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PhotoViewer
// ═══════════════════════════════════════════════════════════
function PhotoViewer({ photos, initialIndex, onClose }: { photos: string[]; initialIndex: number; onClose: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"><X className="h-5 w-5" /></button>
      {photos.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); setCurrentIndex((i) => (i > 0 ? i - 1 : photos.length - 1)); }} className="absolute left-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">&#8249;</button>
          <button onClick={(e) => { e.stopPropagation(); setCurrentIndex((i) => (i < photos.length - 1 ? i + 1 : 0)); }} className="absolute right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">&#8250;</button>
        </>
      )}
      <img src={photos[currentIndex]} alt={`Foto ${currentIndex + 1}`} className="max-h-[90vh] max-w-[95vw] object-contain" onClick={(e) => e.stopPropagation()} />
      {photos.length > 1 && <div className="absolute bottom-4 text-white/70 text-sm">{currentIndex + 1} / {photos.length}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ShareMenu
// ═══════════════════════════════════════════════════════════
function ShareMenu({ post, onClose, onRepost }: { post: PostWithAuthor; onClose: () => void; onRepost: (post: PostWithAuthor) => void }) {
  const handleExternalShare = async () => {
    const shareData = { title: `Post de ${post.author.display_name}`, text: post.content.slice(0, 100) + (post.content.length > 100 ? "..." : ""), url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(`${shareData.text}\n\n\u2014 GDF Chat`); toast.success("Texto copiado!"); }
    } catch { /* cancelled */ }
    onClose();
  };
  const handleCopyLink = async () => {
    try { await navigator.clipboard.writeText(post.content.slice(0, 200)); toast.success("Texto copiado!"); } catch { toast.error("Erro ao copiar"); }
    onClose();
  };
  return (
    <div className="absolute right-0 bottom-full mb-1.5 w-48 rounded-lg border bg-popover p-1 shadow-lg z-30 animate-in fade-in-0 zoom-in-95">
      <button onClick={() => { onRepost(post); onClose(); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs transition-colors hover:bg-accent">
        <Repeat2 className="h-3.5 w-3.5 text-primary" /><span>Compartilhar no feed</span>
      </button>
      <button onClick={handleExternalShare} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs transition-colors hover:bg-accent">
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /><span>Compartilhar fora</span>
      </button>
      <button onClick={handleCopyLink} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs transition-colors hover:bg-accent">
        <Copy className="h-3.5 w-3.5 text-muted-foreground" /><span>Copiar texto</span>
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// FeedView
// ═══════════════════════════════════════════════════════════
export function FeedView({ openUserProfile }: { openUserProfile?: (userId: string) => void }) {
  const { profile } = useStore();
  const navigateToProfile = (uid: string) => {
    if (openUserProfile) openUserProfile(uid);
    else window.dispatchEvent(new CustomEvent("openUserProfile", { detail: { userId: uid } }));
  };

  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [activeMediaCount, setActiveMediaCount] = useState(0);
  const [videoPostsInWindow, setVideoPostsInWindow] = useState(0);

  // Input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const cameraPhotoRef = useRef<HTMLInputElement>(null);
  const cameraVideoRef = useRef<HTMLInputElement>(null);

  // Composer state
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [visibility, setVisibility] = useState<"public" | "followers">("public");

  // Menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Audio recording state
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Viewer / share / repost state
  const [viewerPhotos, setViewerPhotos] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState<string | null>(null);
  const [repostingPost, setRepostingPost] = useState<PostWithAuthor | null>(null);
  const [repostContent, setRepostContent] = useState("");

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    const nb = profile?.neighborhood || "all";
    fetch(`/api/posts?neighborhood=${nb}&limit=30`)
      .then((r) => r.json())
      .then((data) => setPosts(data.posts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profile?.neighborhood]);

  useEffect(() => {
    if (!profile) return;
    fetchMediaCounts();
  }, [profile]);

  const fetchMediaCounts = async () => {
    if (!profile) return;
    try {
      const now = new Date().toISOString();
      const res = await fetch(`/api/posts?authorId=${profile.id}&limit=50`);
      const data = await res.json();
      setActiveMediaCount((data.posts || []).filter((p: PostWithAuthor) => p.expires_at && p.expires_at > now).length);
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
      setVideoPostsInWindow((data.posts || []).filter((p: PostWithAuthor) => p.video_url && p.created_at > twelveHoursAgo).length);
    } catch { /* silent */ }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = MAX_PHOTOS_PER_POST - selectedFiles.length;
    const toAdd = files.slice(0, remaining);
    for (const file of toAdd) {
      const error = validateImageFile(file);
      if (error) { toast.error(error); continue; }
      setSelectedFiles((prev) => [...prev, file]);
      setPreviewUrls((prev) => [...prev, createPreviewUrl(file)]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    setMenuOpen(false);
  };

  const handleCameraPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const error = validateImageFile(file);
    if (error) { toast.error(error); return; }
    setSelectedFiles((prev) => [...prev, file]);
    setPreviewUrls((prev) => [...prev, createPreviewUrl(file)]);
    if (cameraPhotoRef.current) cameraPhotoRef.current.value = "";
    setMenuOpen(false);
  };

  const handleCameraVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { toast.error("V\u00EDdeo muito grande (m\u00E1x 50MB)"); return; }
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      if (video.duration > MAX_VIDEO_DURATION) { toast.error(`V\u00EDdeo muito longo (m\u00E1x ${MAX_VIDEO_DURATION}s)`); URL.revokeObjectURL(video.src); return; }
      setVideoDuration(video.duration);
      setSelectedVideo(file);
      setVideoPreview(URL.createObjectURL(file));
      URL.revokeObjectURL(video.src);
    };
    video.src = URL.createObjectURL(file);
    if (cameraVideoRef.current) cameraVideoRef.current.value = "";
    setMenuOpen(false);
  };

  const removeSelectedFile = (index: number) => {
    revokePreviewUrl(previewUrls[index]);
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["video/mp4", "video/webm", "video/quicktime"].includes(file.type)) { toast.error("Tipo n\u00E3o suportado. Use MP4, WebM ou MOV."); return; }
    if (file.size > 50 * 1024 * 1024) { toast.error("V\u00EDdeo muito grande (m\u00E1x 50MB)"); return; }
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      if (video.duration > MAX_VIDEO_DURATION) { toast.error(`V\u00EDdeo muito longo (m\u00E1x ${MAX_VIDEO_DURATION}s)`); URL.revokeObjectURL(video.src); return; }
      setVideoDuration(video.duration);
      setSelectedVideo(file);
      setVideoPreview(URL.createObjectURL(file));
      URL.revokeObjectURL(video.src);
    };
    video.src = URL.createObjectURL(file);
    if (videoInputRef.current) videoInputRef.current.value = "";
    setMenuOpen(false);
  };

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg", "audio/wav", "audio/x-m4a"].includes(file.type)) { toast.error("Tipo n\u00E3o suportado. Use MP3, M4A, WebM, OGG ou WAV."); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("\u00C1udio muito grande (m\u00E1x 10MB)"); return; }
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      if (audio.duration > MAX_AUDIO_DURATION) { toast.error(`\u00C1udio muito longo (m\u00E1x ${MAX_AUDIO_DURATION}s)`); URL.revokeObjectURL(audio.src); return; }
      setAudioDuration(audio.duration);
      setSelectedAudio(file);
      setAudioPreview(URL.createObjectURL(file));
      URL.revokeObjectURL(audio.src);
    };
    audio.src = URL.createObjectURL(file);
    if (audioInputRef.current) audioInputRef.current.value = "";
    setMenuOpen(false);
  };

  // ═══════ Direct audio recording ═══════
  const startAudioRecording = async () => {
    setMenuOpen(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      let mimeType = "audio/webm";
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "audio/mp4";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const ext = mimeType.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `grava\u00E7\u00E3o.${ext}`, { type: mimeType });
        const url = URL.createObjectURL(file);
        const tempAudio = document.createElement("audio");
        tempAudio.preload = "metadata";
        tempAudio.onloadedmetadata = () => {
          setAudioDuration(tempAudio.duration);
          setSelectedAudio(file);
          setAudioPreview(url);
          URL.revokeObjectURL(tempAudio.src);
        };
        tempAudio.src = url;
        if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach((t) => t.stop()); mediaStreamRef.current = null; }
        mediaRecorderRef.current = null;
        setIsRecordingAudio(false);
      };
      mediaRecorder.start(1000);
      setIsRecordingAudio(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev + 1 >= MAX_AUDIO_DURATION) { stopAudioRecording(); return MAX_AUDIO_DURATION; }
          return prev + 1;
        });
      }, 1000);
    } catch {
      toast.error("N\u00E3o foi poss\u00EDvel acessar o microfone. Verifique as permiss\u00F5es.");
    }
  };

  const stopAudioRecording = () => {
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
  };

  const cancelAudioRecording = () => {
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") { mediaRecorderRef.current.onstop = null; mediaRecorderRef.current.stop(); }
    if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach((t) => t.stop()); mediaStreamRef.current = null; }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setIsRecordingAudio(false);
    setRecordingSeconds(0);
  };

  const clearMedia = () => {
    setSelectedFiles([]);
    previewUrls.forEach(revokePreviewUrl);
    setPreviewUrls([]);
    setSelectedVideo(null);
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoPreview(null);
    setVideoDuration(0);
    setSelectedAudio(null);
    if (audioPreview) URL.revokeObjectURL(audioPreview);
    setAudioPreview(null);
    setAudioDuration(0);
    cancelAudioRecording();
  };

  const uploadPhotos = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of selectedFiles) {
      try {
        const compressed = await compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.55, maxSizeKB: 150 });
        const formData = new FormData();
        formData.append("file", compressed, "photo.webp");
        formData.append("folder", "posts");
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.url) urls.push(data.url);
        else toast.error(data.error || "Erro ao enviar foto");
      } catch { toast.error("Erro ao processar foto"); }
    }
    return urls;
  };

  const uploadVideo = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "posts");
      const res = await fetch("/api/upload/video", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) return data.url;
      toast.error(data.error || "Erro ao enviar v\u00EDdeo");
      return null;
    } catch { toast.error("Erro ao enviar v\u00EDdeo"); return null; }
  };

  const uploadAudio = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "posts");
      const res = await fetch("/api/upload/audio", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) return data.url;
      toast.error(data.error || "Erro ao enviar \u00E1udio");
      return null;
    } catch { toast.error("Erro ao enviar \u00E1udio"); return null; }
  };

  const handlePost = async () => {
    const hasMedia = selectedFiles.length > 0 || selectedVideo || selectedAudio;
    if (!profile) return;
    if (!content.trim() && !hasMedia) return;

    if (hasMedia && activeMediaCount >= MAX_ACTIVE_MEDIA_POSTS) {
      toast.error(`Voc\u00EA j\u00E1 tem ${MAX_ACTIVE_MEDIA_POSTS} posts com m\u00EDdia ativos. Aguarde a expira\u00E7\u00E3o.`);
      return;
    }
    if (selectedVideo && videoPostsInWindow >= MAX_VIDEO_POSTS_PER_12H) {
      toast.error(`Voc\u00EA j\u00E1 postou ${MAX_VIDEO_POSTS_PER_12H} v\u00EDdeos nas \u00FAltimas 12h.`);
      return;
    }

    setUploading(true);
    try {
      let imageUrls: string[] = [];
      let videoUrl: string | null = null;
      let audioUrl: string | null = null;

      if (selectedFiles.length > 0) {
        imageUrls = await uploadPhotos();
        if (imageUrls.length === 0 && selectedFiles.length > 0) { toast.error("Falha ao enviar fotos."); setUploading(false); return; }
      }
      if (selectedVideo) {
        videoUrl = await uploadVideo(selectedVideo);
        if (!videoUrl) { setUploading(false); return; }
      }
      if (selectedAudio) {
        audioUrl = await uploadAudio(selectedAudio);
        if (!audioUrl) { setUploading(false); return; }
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim() || (hasMedia ? "\uD83D\uDCF7" : ""),
          neighborhood: profile.neighborhood,
          imageUrls,
          videoUrl,
          audioUrl,
          audioDuration,
          videoDuration,
          visibility,
        }),
      });
      const data = await res.json();
      if (data.post) {
        setPosts((prev) => [{ ...data.post, comment_count: data.post.comment_count || 0 }, ...prev]);
        setContent("");
        clearMedia();
        fetchMediaCounts();
        toast.success("Post publicado!");
      } else if (data.error) { toast.error(data.error); }
    } catch { toast.error("Erro ao publicar"); }
    setUploading(false);
  };

  const handleRepost = async (post: PostWithAuthor) => {
    if (!profile) return;
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: repostContent.trim() || `Compartilhado de @${post.author.username}`,
          neighborhood: profile.neighborhood,
          imageUrls: [],
          videoUrl: null,
          audioUrl: null,
          visibility: "public",
          sharedPostId: post.id,
        }),
      });
      const data = await res.json();
      if (data.post) {
        setPosts((prev) => [{ ...data.post, comment_count: data.post.comment_count || 0, shared_post: post }, ...prev]);
        setRepostingPost(null);
        setRepostContent("");
        toast.success("Compartilhado no feed!");
      } else if (data.error) { toast.error(data.error); }
    } catch { toast.error("Erro ao compartilhar"); }
  };

  const handleReaction = async (postId: string, type: string) => {
    if (!profile) return;
    try {
      const res = await fetch("/api/posts/reaction", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId, type }) });
      const data = await res.json();
      if (data.reacted !== undefined) {
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, reactions: data.reacted ? [...p.reactions, { user_id: profile.id, type }] : p.reactions.filter((r) => !(r.user_id === profile.id && r.type === type)) } : p));
      }
    } catch { /* silent */ }
  };

  const handleDelete = async (postId: string) => {
    try {
      await fetch(`/api/posts?id=${postId}`, { method: "DELETE" });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success("Post exclu\u00EDdo");
      fetchMediaCounts();
    } catch { toast.error("Erro ao excluir"); }
  };

  const updateCommentCount = (postId: string, delta: number) => {
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comment_count: Math.max(0, (p.comment_count || 0) + delta) } : p));
  };

  const openPhotoViewer = (photos: string[], index: number) => {
    setViewerPhotos(photos);
    setViewerIndex(index);
    setViewerOpen(true);
  };

  const hasPhotosInComposer = selectedFiles.length > 0;
  const hasVideoInComposer = !!selectedVideo;
  const hasAudioInComposer = !!selectedAudio;
  const hasAnyMedia = hasPhotosInComposer || hasVideoInComposer || hasAudioInComposer;
  const canAddPhotos = !hasVideoInComposer && !hasAudioInComposer && selectedFiles.length < MAX_PHOTOS_PER_POST;
  const canAddVideo = !hasPhotosInComposer && !hasAudioInComposer && !hasVideoInComposer;
  const canAddAudio = !hasPhotosInComposer && !hasVideoInComposer && !hasAudioInComposer;
  const canPost = content.trim() || hasAnyMedia;

  if (loading) return <FeedSkeleton />;

  return (
    <div className="space-y-3">
      {/* ═══════ COMPOSER ═══════ */}
      <div className="relative z-10 rounded-xl border bg-card p-3 shadow-sm">
        {/* Recording banner */}
        {isRecordingAudio && (
          <div className="-mx-3 -mt-3 mb-3 rounded-t-xl bg-red-500 px-3 py-2.5 text-white">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20">
                <Mic className="h-4 w-4" />
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold">Gravando</span>
                  <span className="text-sm font-bold tabular-nums">{formatDuration(recordingSeconds)}</span>
                  <span className="text-[9px] text-white/60">/ {formatDuration(MAX_AUDIO_DURATION)}</span>
                </div>
                <div className="mt-1 h-1 bg-white/25 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all" style={{ width: `${(recordingSeconds / MAX_AUDIO_DURATION) * 100}%` }} />
                </div>
              </div>
              <button onClick={stopAudioRecording} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-red-500 shadow hover:bg-white/90" title="Parar">
                <Square className="h-3.5 w-3.5" />
              </button>
              <button onClick={cancelAudioRecording} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 hover:bg-white/30" title="Cancelar">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2.5">
          <UserAvatar user={{ id: profile?.id || "", display_name: profile?.display_name || "?", avatar_url: profile?.avatar_url }} className="h-8 w-8 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-2">
            <textarea
              placeholder={hasAnyMedia ? "Texto (opcional)..." : "O que est\u00E1 acontecendo?"}
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 500))}
              className="w-full min-h-[52px] resize-none rounded-lg border-0 bg-transparent px-0 py-1 text-sm focus:outline-none placeholder:text-muted-foreground/50"
              rows={2}
            />

            {/* Photo previews - horizontal scroll */}
            {hasPhotosInComposer && previewUrls.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {previewUrls.map((url, i) => (
                  <div key={i} className="relative shrink-0 group">
                    <img src={url} alt="" className="h-14 w-14 rounded-lg object-cover" />
                    <button onClick={() => removeSelectedFile(i)} className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Video preview */}
            {hasVideoInComposer && videoPreview && (
              <div className="relative rounded-lg overflow-hidden">
                <video src={videoPreview} className="w-full max-h-32 object-cover" playsInline muted />
                <div className="absolute top-1 left-1 flex items-center gap-1 rounded bg-black/50 px-1 py-0.5 text-[8px] text-white">
                  <Video className="h-2.5 w-2.5" />{formatDuration(videoDuration)}
                </div>
                <button onClick={() => { setSelectedVideo(null); if (videoPreview) URL.revokeObjectURL(videoPreview); setVideoPreview(null); setVideoDuration(0); }} className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white">
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            )}

            {/* Audio preview */}
            {hasAudioInComposer && audioPreview && (
              <div className="relative flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/10 px-2.5 py-2">
                <Volume2 className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-[11px] font-medium">\u00C1udio</span>
                <span className="text-[10px] text-muted-foreground">{formatDuration(audioDuration)}</span>
                <audio src={audioPreview} controls className="flex-1 h-6 min-w-0" />
                <button onClick={() => { setSelectedAudio(null); if (audioPreview) URL.revokeObjectURL(audioPreview); setAudioPreview(null); setAudioDuration(0); }} className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            )}

            {/* ═══════ Action bar ═══════ */}
            <div className="flex items-center justify-between -mx-1">
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className={`flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-medium transition-colors ${menuOpen ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-primary hover:bg-primary/5"}`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <ChevronDown className={`h-3 w-3 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
                </button>

                {menuOpen && (
                  <div className="absolute left-0 top-full mt-1 w-48 max-w-[calc(100vw-3rem)] rounded-lg border bg-popover p-1 shadow-lg z-50 animate-in fade-in-0 zoom-in-95">
                    <button onClick={() => { if (canAddPhotos) cameraPhotoRef.current?.click(); }} disabled={!canAddPhotos} className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-xs transition-colors ${canAddPhotos ? "hover:bg-accent" : "text-muted-foreground/40 cursor-not-allowed"}`}>
                      <Camera className={`h-3.5 w-3.5 ${canAddPhotos ? "text-primary" : ""}`} />Tirar foto
                    </button>
                    <button onClick={() => { if (canAddPhotos) fileInputRef.current?.click(); }} disabled={!canAddPhotos} className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-xs transition-colors ${canAddPhotos ? "hover:bg-accent" : "text-muted-foreground/40 cursor-not-allowed"}`}>
                      <ImagePlus className={`h-3.5 w-3.5 ${canAddPhotos ? "text-primary" : ""}`} />Escolher fotos
                    </button>
                    <div className="my-0.5 h-px bg-border" />
                    <button onClick={() => { if (canAddVideo && videoPostsInWindow < MAX_VIDEO_POSTS_PER_12H) cameraVideoRef.current?.click(); }} disabled={!canAddVideo || videoPostsInWindow >= MAX_VIDEO_POSTS_PER_12H} className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-xs transition-colors ${canAddVideo && videoPostsInWindow < MAX_VIDEO_POSTS_PER_12H ? "hover:bg-accent" : "text-muted-foreground/40 cursor-not-allowed"}`}>
                      <Video className={`h-3.5 w-3.5 ${canAddVideo && videoPostsInWindow < MAX_VIDEO_POSTS_PER_12H ? "text-primary" : ""}`} />Gravar v\u00EDdeo
                    </button>
                    <button onClick={() => { if (canAddVideo && videoPostsInWindow < MAX_VIDEO_POSTS_PER_12H) videoInputRef.current?.click(); }} disabled={!canAddVideo || videoPostsInWindow >= MAX_VIDEO_POSTS_PER_12H} className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-xs transition-colors ${canAddVideo && videoPostsInWindow < MAX_VIDEO_POSTS_PER_12H ? "hover:bg-accent" : "text-muted-foreground/40 cursor-not-allowed"}`}>
                      <Video className={`h-3.5 w-3.5 ${canAddVideo && videoPostsInWindow < MAX_VIDEO_POSTS_PER_12H ? "text-muted-foreground" : ""}`} />Escolher v\u00EDdeo
                    </button>
                    <div className="my-0.5 h-px bg-border" />
                    <button onClick={() => { if (canAddAudio && !isRecordingAudio) startAudioRecording(); }} disabled={!canAddAudio || isRecordingAudio} className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-xs transition-colors ${canAddAudio && !isRecordingAudio ? "hover:bg-accent" : "text-muted-foreground/40 cursor-not-allowed"}`}>
                      <Mic className={`h-3.5 w-3.5 ${canAddAudio && !isRecordingAudio ? "text-primary" : ""}`} />Gravar \u00E1udio
                    </button>
                    <button onClick={() => { if (canAddAudio) audioInputRef.current?.click(); }} disabled={!canAddAudio} className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-xs transition-colors ${canAddAudio ? "hover:bg-accent" : "text-muted-foreground/40 cursor-not-allowed"}`}>
                      <Music className={`h-3.5 w-3.5 ${canAddAudio ? "text-muted-foreground" : ""}`} />Escolher \u00E1udio
                    </button>
                    <div className="my-0.5 h-px bg-border" />
                    <button onClick={() => setVisibility((v) => v === "public" ? "followers" : "public")} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-xs transition-colors hover:bg-accent">
                      {visibility === "public" ? <Globe className="h-3.5 w-3.5 text-primary" /> : <UsersIcon className="h-3.5 w-3.5 text-amber-500" />}
                      <span>{visibility === "public" ? "P\u00FAblico" : "Seguidores"}</span>
                    </button>
                  </div>
                )}

                {/* Hidden inputs */}
                <input ref={cameraPhotoRef} type="file" accept="image/*" capture="environment" onChange={handleCameraPhotoSelect} className="hidden" />
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={handleFileSelect} className="hidden" />
                <input ref={cameraVideoRef} type="file" accept="video/*" capture="environment" onChange={handleCameraVideoSelect} className="hidden" />
                <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" onChange={handleVideoSelect} className="hidden" />
                <input ref={audioInputRef} type="file" accept="audio/mpeg,audio/mp4,audio/webm,audio/ogg,audio/wav,audio/x-m4a" onChange={handleAudioSelect} className="hidden" />
              </div>

              <div className="flex items-center gap-1.5">
                {content.length > 0 && (
                  <span className={`text-[9px] tabular-nums ${content.length > 450 ? "text-destructive" : "text-muted-foreground/60"}`}>
                    {content.length}/500
                  </span>
                )}
                <Button size="sm" disabled={!canPost || uploading} onClick={handlePost} className="rounded-full px-4 h-7 text-xs shadow-sm">
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Publicar"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Repost dialog */}
      {repostingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { setRepostingPost(null); setRepostContent(""); }}>
          <div className="w-full max-w-md mx-4 rounded-xl border bg-card p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-2">Compartilhar no feed</h3>
            <div className="rounded-lg border bg-muted/30 p-2.5 mb-2.5">
              <div className="flex items-center gap-2 mb-1">
                <UserAvatar user={repostingPost.author} className="h-5 w-5" />
                <span className="text-[11px] font-semibold">{repostingPost.author.display_name}</span>
                <span className="text-[9px] text-muted-foreground">@{repostingPost.author.username}</span>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-3">{repostingPost.content}</p>
            </div>
            <textarea placeholder="Coment\u00E1rio (opcional)..." value={repostContent} onChange={(e) => setRepostContent(e.target.value.slice(0, 200))} className="w-full min-h-[48px] resize-none rounded-lg border-0 bg-muted/50 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60" rows={2} />
            <div className="flex items-center gap-2 mt-2.5">
              <Button variant="outline" size="sm" onClick={() => { setRepostingPost(null); setRepostContent(""); }} className="rounded-full text-xs h-7">Cancelar</Button>
              <Button size="sm" onClick={() => handleRepost(repostingPost)} className="rounded-full gap-1 text-xs h-7">
                <Repeat2 className="h-3 w-3" /> Compartilhar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {posts.length === 0 && (
        <div className="py-12 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <MessageCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">Nenhum post ainda. Seja o primeiro!</p>
        </div>
      )}

      {/* Posts */}
      {posts.map((post) => (
        <PostThread
          key={post.id}
          post={post}
          profile={profile}
          onReaction={handleReaction}
          onDelete={handleDelete}
          onUpdateCommentCount={updateCommentCount}
          openUserProfile={navigateToProfile}
          onPhotoClick={(index) => openPhotoViewer(post.image_urls || [], index)}
          onRepost={(p) => { setRepostingPost(p); setRepostContent(""); }}
          shareMenuOpen={shareMenuOpen}
          setShareMenuOpen={setShareMenuOpen}
        />
      ))}

      {viewerOpen && <PhotoViewer photos={viewerPhotos} initialIndex={viewerIndex} onClose={() => setViewerOpen(false)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PostThread
// ═══════════════════════════════════════════════════════════
function PostThread({
  post, profile, onReaction, onDelete, onUpdateCommentCount, openUserProfile, onPhotoClick, onRepost, shareMenuOpen, setShareMenuOpen,
}: {
  post: PostWithAuthor;
  profile: Profile | null;
  onReaction: (postId: string, type: string) => void;
  onDelete: (postId: string) => void;
  onUpdateCommentCount: (postId: string, delta: number) => void;
  openUserProfile?: (userId: string) => void;
  onPhotoClick?: (index: number) => void;
  onRepost: (post: PostWithAuthor) => void;
  shareMenuOpen: string | null;
  setShareMenuOpen: (id: string | null) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [showReactions, setShowReactions] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const shareRef = useRef<HTMLDivElement>(null);

  const reactionGroups = buildReactionGroups(post.reactions || []);
  const commentCount = post.comment_count || 0;
  const hasPhotos = post.image_urls && post.image_urls.length > 0;
  const hasVideo = !!post.video_url;
  const hasAudio = !!post.audio_url;
  const isOwnPost = post.author_id === profile?.id;

  const [expirationLabel, setExpirationLabel] = useState<string>("");
  useEffect(() => {
    if (!post.expires_at) return;
    const update = () => setExpirationLabel(getExpirationLabel(post.expires_at!));
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [post.expires_at]);

  useEffect(() => {
    if (shareMenuOpen !== post.id) return;
    const handler = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShareMenuOpen(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [shareMenuOpen, post.id, setShareMenuOpen]);

  const fetchComments = async () => {
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`);
      const data = await res.json();
      if (data.comments) setComments(data.comments);
    } catch { /* silent */ }
    setCommentsLoading(false);
  };

  const toggleComments = () => {
    if (!showComments && comments.length === 0) fetchComments();
    setShowComments(!showComments);
  };

  const openAndFocus = () => {
    if (!showComments) { if (comments.length === 0) fetchComments(); setShowComments(true); }
    setTimeout(() => commentInputRef.current?.focus(), 100);
  };

  const handleReply = (comment: Comment) => {
    setReplyTo(comment);
    if (!showComments) { if (comments.length === 0) fetchComments(); setShowComments(true); }
    setTimeout(() => commentInputRef.current?.focus(), 100);
  };

  const submitComment = async () => {
    if (!commentInput.trim() || !profile || submitting) return;
    setSubmitting(true);
    try {
      const body: { content: string; parentId?: string } = { content: commentInput.trim() };
      if (replyTo) body.parentId = replyTo.id;
      const res = await fetch(`/api/posts/${post.id}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.comment) {
        setComments((prev) => [...prev, data.comment]);
        setCommentInput("");
        setReplyTo(null);
        onUpdateCommentCount(post.id, 1);
        if (!showComments) setShowComments(true);
      } else if (data.error) toast.error(data.error);
    } catch { toast.error("Erro ao comentar"); }
    setSubmitting(false);
  };

  const deleteComment = async (commentId: string) => {
    try {
      const res = await fetch(`/api/posts/${post.id}/comments?commentId=${commentId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) { setComments((prev) => prev.filter((c) => c.id !== commentId)); onUpdateCommentCount(post.id, -1); }
    } catch { toast.error("Erro ao excluir coment\u00E1rio"); }
  };

  const handleCommentReaction = async (commentId: string, type: string) => {
    if (!profile) return;
    try {
      const res = await fetch("/api/comments/reaction", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commentId, type }) });
      const data = await res.json();
      if (data.reacted !== undefined) {
        setComments((prev) => prev.map((c) => {
          if (c.id !== commentId) return c;
          const reactions = data.reacted ? [...(c.reactions || []), { user_id: profile.id, type }] : (c.reactions || []).filter((r: any) => !(r.user_id === profile.id && r.type === type));
          return { ...c, reactions };
        }));
      }
    } catch { /* silent */ }
  };

  const buildCommentTree = (flatComments: Comment[]) => {
    const map = new Map<string, Comment[]>();
    const roots: Comment[] = [];
    for (const c of flatComments) {
      if (c.parent_id) { const children = map.get(c.parent_id) || []; children.push(c); map.set(c.parent_id, children); }
      else roots.push(c);
    }
    return { roots, map };
  };

  const { roots: commentRoots, map: commentMap } = buildCommentTree(comments);

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="p-3">
        {/* Header */}
        <div className="flex items-start gap-2.5">
          <button onClick={() => openUserProfile?.(post.author.id)} className="shrink-0">
            <UserAvatar user={post.author} className="h-9 w-9 hover:opacity-80 transition-opacity" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => openUserProfile?.(post.author.id)} className="text-[13px] font-semibold hover:underline underline-offset-2">
                {post.author.display_name}
              </button>
              <span className="text-[11px] text-muted-foreground">@{post.author.username}</span>
              {post.author.neighborhood && (
                <Badge variant="secondary" className="text-[9px] px-1 py-0 gap-0.5 h-4">
                  <MapPin className="h-2.5 w-2.5" />{post.author.neighborhood}
                </Badge>
              )}
              {post.visibility === "followers" && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 gap-0.5 h-4 text-amber-500 border-amber-500/30">
                  <UsersIcon className="h-2.5 w-2.5" />
                </Badge>
              )}
              <span className="text-[9px] text-muted-foreground/50">\u00B7</span>
              <span className="text-[10px] text-muted-foreground">{timeAgo(post.created_at)}</span>
            </div>

            {/* Content */}
            {post.content && post.content !== "\uD83D\uDCF7" && (
              <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-wrap">{post.content}</p>
            )}

            {/* Shared post */}
            {post.shared_post && (
              <div className="mt-2 rounded-lg border bg-muted/20 p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Repeat2 className="h-2.5 w-2.5 text-muted-foreground" />
                  <span className="text-[9px] text-muted-foreground">Compartilhado de</span>
                </div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <button onClick={() => openUserProfile?.(post.shared_post!.author.id)} className="shrink-0"><UserAvatar user={post.shared_post.author} className="h-5 w-5" /></button>
                  <span className="text-[11px] font-semibold">{post.shared_post.author.display_name}</span>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-3">{post.shared_post.content}</p>
              </div>
            )}

            {/* Media */}
            {hasPhotos && <div className="mt-2"><PhotoGrid photos={post.image_urls!} onPhotoClick={onPhotoClick} /></div>}
            {hasVideo && <div className="mt-2"><VideoPlayer src={post.video_url!} /></div>}
            {hasAudio && <div className="mt-2"><AudioPlayer src={post.audio_url!} /></div>}

            {/* Expiration */}
            {post.expires_at && expirationLabel && (
              <div className="mt-2 inline-flex items-center gap-1 text-[9px] text-amber-500 bg-amber-500/5 rounded-full px-2 py-0.5">
                <Clock className="h-2.5 w-2.5" />{expirationLabel}
              </div>
            )}

            {/* Action bar */}
            <div className="mt-2 flex items-center -ml-1">
              {/* Reactions */}
              <div className="relative">
                <button
                  onClick={() => setShowReactions(!showReactions)}
                  className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] transition-colors ${post.reactions?.some((r) => r.user_id === profile?.id) ? "text-primary bg-primary/5" : "text-muted-foreground hover:bg-accent"}`}
                >
                  <Heart className="h-3.5 w-3.5" />
                  {post.reactions?.length > 0 && <span>{post.reactions.length}</span>}
                </button>
                {showReactions && (
                  <div className="absolute bottom-full left-0 mb-1 flex gap-0.5 rounded-lg border bg-popover p-1 shadow-lg z-20">
                    {REACTION_EMOJIS.map(({ type, emoji, label }) => {
                      const isActive = post.reactions?.some((r) => r.user_id === profile?.id && r.type === type);
                      return (
                        <button key={type} onClick={() => { onReaction(post.id, type); setShowReactions(false); }} className={`rounded p-1 text-base transition-all hover:scale-125 ${isActive ? "bg-primary/10 ring-1 ring-primary" : ""}`} title={label}>
                          {emoji}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Reaction pills */}
              {reactionGroups.length > 0 && (
                <div className="flex gap-0.5">
                  {reactionGroups.slice(0, 3).map((g, i) => (
                    <span key={i} className="inline-flex items-center gap-0.5 rounded-full bg-muted/50 px-1 py-0.5 text-[9px]">
                      {g.emoji} {g.count}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex-1" />

              {/* Comment */}
              <button onClick={openAndFocus} className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent transition-colors">
                <MessageCircle className="h-3.5 w-3.5" />
                {commentCount > 0 && commentCount}
              </button>

              {/* Share */}
              <div className="relative" ref={shareRef}>
                <button onClick={() => setShareMenuOpen(shareMenuOpen === post.id ? null : post.id)} className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent transition-colors">
                  <Share2 className="h-3.5 w-3.5" />
                </button>
                {shareMenuOpen === post.id && <ShareMenu post={post} onClose={() => setShareMenuOpen(null)} onRepost={onRepost} />}
              </div>

              {/* Delete */}
              {isOwnPost && (
                <button onClick={() => onDelete(post.id)} className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Comments toggle */}
      {(commentCount > 0 || comments.length > 0) && (
        <button onClick={toggleComments} className="flex w-full items-center justify-center gap-1 border-t py-2 text-[11px] text-muted-foreground hover:bg-accent/30 transition-colors">
          {showComments ? <>Ocultar <ChevronUp className="h-3 w-3" /></> : <>{commentCount || comments.length} coment\u00E1rio{(commentCount || comments.length) !== 1 ? "s" : ""} <ChevronDown className="h-3 w-3" /></>}
        </button>
      )}

      {/* Comments */}
      {showComments && (
        <div className="border-t bg-muted/5">
          <div className="max-h-64 overflow-y-auto px-3 py-2">
            {commentsLoading ? (
              <div className="space-y-2">{[1, 2].map((i) => (<div key={i} className="flex gap-2 animate-pulse"><div className="h-5 w-5 rounded-full bg-muted" /><div className="flex-1 space-y-1"><div className="h-2.5 w-20 rounded bg-muted" /><div className="h-2.5 w-full rounded bg-muted" /></div></div>))}</div>
            ) : comments.length === 0 ? (
              <p className="text-center text-[11px] text-muted-foreground py-2">Nenhum coment\u00E1rio</p>
            ) : (
              <div className="space-y-2.5">
                {commentRoots.map((comment) => (
                  <CommentItem key={comment.id} comment={comment} replies={commentMap.get(comment.id) || []} profile={profile} commentMap={commentMap} onDelete={deleteComment} onReply={handleReply} onReaction={handleCommentReaction} openUserProfile={openUserProfile} depth={0} />
                ))}
              </div>
            )}
          </div>

          {profile && (
            <div className="border-t px-3 py-2">
              {replyTo && (
                <div className="flex items-center gap-1 mb-1 text-[10px] text-muted-foreground">
                  <Reply className="h-2.5 w-2.5" />
                  <span>Respondendo <strong>@{replyTo.author.display_name}</strong></span>
                  <button onClick={() => setReplyTo(null)} className="text-destructive hover:underline ml-0.5">Cancelar</button>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <UserAvatar user={{ id: profile.id, display_name: profile.display_name, avatar_url: profile.avatar_url }} className="h-5 w-5 shrink-0" />
                <Input ref={commentInputRef} placeholder={replyTo ? `@${replyTo.author.display_name}...` : "Comentar..."} value={commentInput} onChange={(e) => setCommentInput(e.target.value.slice(0, 300))} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submitComment()} className="h-7 text-[11px] border-0 bg-muted/40 focus-visible:ring-1" />
                <Button size="icon" onClick={submitComment} disabled={!commentInput.trim() || submitting} className="h-7 w-7 shrink-0 rounded-full"><Send className="h-3 w-3" /></Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick comment */}
      {!showComments && profile && (
        <div className="flex items-center gap-1.5 border-t px-3 py-2">
          <UserAvatar user={{ id: profile.id, display_name: profile.display_name, avatar_url: profile.avatar_url }} className="h-5 w-5 shrink-0" />
          <Input placeholder="Comentar..." value={commentInput} onChange={(e) => setCommentInput(e.target.value.slice(0, 300))} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && commentInput.trim()) openAndFocus(); }} onFocus={openAndFocus} className="h-7 text-[11px] border-0 bg-muted/40 focus-visible:ring-1" />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CommentItem
// ═══════════════════════════════════════════════════════════
function CommentItem({ comment, replies, profile, commentMap, onDelete, onReply, onReaction, openUserProfile, depth }: {
  comment: Comment; replies: Comment[]; profile: Profile | null; commentMap: Map<string, Comment[]>;
  onDelete: (commentId: string) => void; onReply: (comment: Comment) => void;
  onReaction: (commentId: string, type: string) => void; openUserProfile?: (userId: string) => void; depth: number;
}) {
  return (
    <div className={depth > 0 ? "ml-5 border-l border-primary/15 pl-2.5" : ""}>
      <div className="flex gap-2">
        <button onClick={() => openUserProfile?.(comment.author.id)} className="shrink-0">
          <UserAvatar user={comment.author} className="h-5 w-5 hover:opacity-80 transition-opacity" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <button onClick={() => openUserProfile?.(comment.author.id)} className="text-[11px] font-semibold hover:underline">{comment.author.display_name}</button>
            <span className="text-[9px] text-muted-foreground">{timeAgo(comment.created_at)}</span>
          </div>
          <p className="text-[11px] leading-relaxed">{comment.content}</p>
          <div className="mt-0.5 flex items-center gap-2 flex-wrap">
            {REACTION_EMOJIS.slice(0, 4).map(({ type, emoji }) => {
              const isActive = comment.reactions?.some((r) => r.user_id === profile?.id && r.type === type);
              const count = comment.reactions?.filter((r) => r.type === type).length || 0;
              if (count === 0 && !isActive) return null;
              return (
                <button key={type} onClick={() => onReaction(comment.id, type)} className={`text-[9px] transition-colors ${isActive ? "text-primary font-semibold" : "hover:text-primary"}`}>
                  {emoji}{count > 0 && ` ${count}`}
                </button>
              );
            })}
            <button onClick={() => onReply(comment)} className="text-[9px] text-muted-foreground hover:text-primary">
              <Reply className="h-2.5 w-2.5 inline" /> Responder
            </button>
            {comment.author_id === profile?.id && (
              <button onClick={() => onDelete(comment.id)} className="text-[9px] text-muted-foreground hover:text-destructive">
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        </div>
      </div>
      {replies.map((reply) => (
        <CommentItem key={reply.id} comment={reply} replies={commentMap.get(reply.id) || []} profile={profile} commentMap={commentMap} onDelete={onDelete} onReply={onReply} onReaction={onReaction} openUserProfile={openUserProfile} depth={depth + 1} />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// FeedSkeleton
// ═══════════════════════════════════════════════════════════
function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border bg-card p-3 animate-pulse">
          <div className="flex gap-2.5">
            <div className="h-9 w-9 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-28 rounded bg-muted" />
              <div className="h-2.5 w-full rounded bg-muted" />
              <div className="h-2.5 w-2/3 rounded bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
