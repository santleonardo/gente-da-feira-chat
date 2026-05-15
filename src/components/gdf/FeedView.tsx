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
const MAX_VIDEO_DURATION = 30; // seconds
const MAX_AUDIO_DURATION = 60; // seconds

const REACTION_EMOJIS = [
  { type: "like", emoji: "❤️", label: "Curtir" },
  { type: "laugh", emoji: "😂", label: "Engraçado" },
  { type: "sad", emoji: "😔", label: "Triste" },
  { type: "wow", emoji: "😲", label: "Uau" },
  { type: "angry", emoji: "😡", label: "Bravo" },
  { type: "love", emoji: "😍", label: "Amei" },
] as const;

function buildReactionGroups(reactions: { user_id: string; type: string }[]) {
  const groups: Record<string, { emoji: string; count: number; types: string[] }> = {};
  for (const r of reactions) {
    const match = REACTION_EMOJIS.find((e) => e.type === r.type);
    const emoji = match?.emoji || "❤️";
    if (!groups[r.type]) groups[r.type] = { emoji, count: 0, types: [r.type] };
    groups[r.type].count++;
  }
  return Object.values(groups);
}

function getExpirationLabel(expiresAt: string): string {
  const now = Date.now();
  const expires = new Date(expiresAt).getTime();
  const diff = expires - now;
  if (diff <= 0) return "Expirado";
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `Expira em ${hours}h${mins > 0 ? ` ${mins}min` : ""}`;
  return `Expira em ${mins}min`;
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
    <div className="mt-2.5 relative rounded-3xl overflow-hidden bg-black shadow-[0_2px_8px_rgba(0,0,0,0.03),0_10px_30px_rgba(0,0,0,0.04)] group">
      <video
        ref={videoRef}
        src={src}
        className="w-full max-h-96 object-contain"
        playsInline
        preload="metadata"
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
        onEnded={() => setPlaying(false)}
        onClick={toggle}
      />
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer" onClick={toggle}>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#01386A] shadow-lg transition-transform hover:scale-110">
            <Play className="h-8 w-8 text-white fill-white ml-1" />
          </div>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="text-white">
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <div className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden cursor-pointer" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            if (videoRef.current && duration) videoRef.current.currentTime = pct * duration;
          }}>
            <div className="h-full bg-white rounded-full transition-all" style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }} />
          </div>
          <span className="text-[10px] text-white/80 tabular-nums">{formatDuration(currentTime)}/{formatDuration(duration)}</span>
        </div>
      </div>
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 rounded-full bg-[#f7f75e] backdrop-blur-sm px-2.5 py-1 text-[10px] font-semibold text-[#000305]">
        <Video className="h-3 w-3" /> Vídeo
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
    <div className="mt-2.5 rounded-3xl bg-[#f7f75e]/[0.08] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.03),0_10px_30px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-3.5">
        <button onClick={toggle} className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#000305] text-white shadow-md hover:bg-[#000305]/90 transition-all hover:scale-105">
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-semibold text-[#000305]/70 tabular-nums">{formatDuration(currentTime)}</span>
            <span className="text-[10px] text-[#01386A]/30">/</span>
            <span className="text-[11px] text-[#01386A]/40 tabular-nums">{formatDuration(duration)}</span>
          </div>
          <div className="h-1 bg-[#01386A]/20 rounded-full overflow-hidden cursor-pointer" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            if (audioRef.current && duration) audioRef.current.currentTime = pct * duration;
          }}>
            <div className="h-full bg-[#01386A] rounded-full transition-all" style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }} />
          </div>
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
      <button onClick={() => onPhotoClick?.(0)} className="mt-2.5 w-full overflow-hidden rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.03),0_10px_30px_rgba(0,0,0,0.04)]">
        <img src={photos[0]} alt="Foto do post" className="w-full max-h-80 object-cover hover:opacity-95 transition-opacity" loading="lazy" />
      </button>
    );
  }
  if (count === 2) {
    return (
      <div className="mt-2.5 grid grid-cols-2 gap-1 overflow-hidden rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.03),0_10px_30px_rgba(0,0,0,0.04)]">
        {photos.map((url, i) => (
          <button key={i} onClick={() => onPhotoClick?.(i)} className="overflow-hidden">
            <img src={url} alt={`Foto ${i + 1}`} className="w-full h-44 object-cover hover:opacity-95 transition-opacity" loading="lazy" />
          </button>
        ))}
      </div>
    );
  }
  if (count === 3) {
    return (
      <div className="mt-2.5 grid grid-cols-2 gap-1 overflow-hidden rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.03),0_10px_30px_rgba(0,0,0,0.04)]">
        <button onClick={() => onPhotoClick?.(0)} className="row-span-2 overflow-hidden">
          <img src={photos[0]} alt="Foto 1" className="w-full h-full object-cover hover:opacity-95 transition-opacity" loading="lazy" />
        </button>
        <button onClick={() => onPhotoClick?.(1)} className="overflow-hidden">
          <img src={photos[1]} alt="Foto 2" className="w-full h-44 object-cover hover:opacity-95 transition-opacity" loading="lazy" />
        </button>
        <button onClick={() => onPhotoClick?.(2)} className="overflow-hidden">
          <img src={photos[2]} alt="Foto 3" className="w-full h-44 object-cover hover:opacity-95 transition-opacity" loading="lazy" />
        </button>
      </div>
    );
  }
  return (
    <div className="mt-2.5 grid grid-cols-2 gap-1 overflow-hidden rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.03),0_10px_30px_rgba(0,0,0,0.04)]">
      {photos.slice(0, 4).map((url, i) => (
        <button key={i} onClick={() => onPhotoClick?.(i)} className="relative overflow-hidden">
          <img src={url} alt={`Foto ${i + 1}`} className="w-full h-44 object-cover hover:opacity-95 transition-opacity" loading="lazy" />
          {i === 3 && count > 4 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white font-bold text-lg">+{count - 4}</div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#000305]/90 backdrop-blur-sm" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-[#f7f75e] hover:text-[#000305] transition-colors"><X className="h-5 w-5" /></button>
      {photos.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); setCurrentIndex((i) => (i > 0 ? i - 1 : photos.length - 1)); }} className="absolute left-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-[#f7f75e] hover:text-[#000305] transition-colors">&#8249;</button>
          <button onClick={(e) => { e.stopPropagation(); setCurrentIndex((i) => (i < photos.length - 1 ? i + 1 : 0)); }} className="absolute right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-[#f7f75e] hover:text-[#000305] transition-colors">&#8250;</button>
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
function ShareMenu({
  post,
  onClose,
  onRepost,
}: {
  post: PostWithAuthor;
  onClose: () => void;
  onRepost: (post: PostWithAuthor) => void;
}) {
  const handleExternalShare = async () => {
    const shareData = {
      title: `Post de ${post.author.display_name}`,
      text: post.content.slice(0, 100) + (post.content.length > 100 ? "..." : ""),
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text}\n\n--- GDF Chat`);
        toast.success("Texto copiado!");
      }
    } catch { /* cancelled */ }
    onClose();
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(post.content.slice(0, 200));
      toast.success("Texto copiado!");
    } catch { toast.error("Erro ao copiar"); }
    onClose();
  };

  return (
    <div className="absolute right-0 bottom-full mb-2 w-52 rounded-2xl bg-white p-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.08),0_10px_30px_rgba(0,0,0,0.06)] z-30 animate-in fade-in-0 zoom-in-95">
      <button
        onClick={() => { onRepost(post); onClose(); }}
        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-[#000305] transition-colors hover:bg-[#f7f75e]/20"
      >
        <Repeat2 className="h-4 w-4 text-[#01386A]" />
        <span>Compartilhar no feed</span>
      </button>
      <button
        onClick={handleExternalShare}
        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-[#000305] transition-colors hover:bg-[#f7f75e]/20"
      >
        <ExternalLink className="h-4 w-4 text-[#01386A]/50" />
        <span>Compartilhar fora</span>
      </button>
      <button
        onClick={handleCopyLink}
        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-[#000305] transition-colors hover:bg-[#f7f75e]/20"
      >
        <Copy className="h-4 w-4 text-[#01386A]/50" />
        <span>Copiar texto</span>
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

  // Audio recording state (direct in-app recording)
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Viewer state
  const [viewerPhotos, setViewerPhotos] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);

  // Share state
  const [shareMenuOpen, setShareMenuOpen] = useState<string | null>(null);

  // Repost state
  const [repostingPost, setRepostingPost] = useState<PostWithAuthor | null>(null);
  const [repostContent, setRepostContent] = useState("");

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
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
      const active = (data.posts || []).filter(
        (p: PostWithAuthor) => p.expires_at && p.expires_at > now
      );
      setActiveMediaCount(active.length);

      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
      const recentVideos = (data.posts || []).filter(
        (p: PostWithAuthor) => p.video_url && p.created_at > twelveHoursAgo
      );
      setVideoPostsInWindow(recentVideos.length);
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
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Vídeo muito grande (máx 50MB)");
      return;
    }
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      if (video.duration > MAX_VIDEO_DURATION) {
        toast.error(`Vídeo muito longo (máx ${MAX_VIDEO_DURATION}s)`);
        URL.revokeObjectURL(video.src);
        return;
      }
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
    if (!["video/mp4", "video/webm", "video/quicktime"].includes(file.type)) {
      toast.error("Tipo não suportado. Use MP4, WebM ou MOV.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Vídeo muito grande (máx 50MB)");
      return;
    }
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      if (video.duration > MAX_VIDEO_DURATION) {
        toast.error(`Vídeo muito longo (máx ${MAX_VIDEO_DURATION}s)`);
        URL.revokeObjectURL(video.src);
        return;
      }
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
    if (!["audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg", "audio/wav", "audio/x-m4a"].includes(file.type)) {
      toast.error("Tipo não suportado. Use MP3, M4A, WebM, OGG ou WAV.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Áudio muito grande (máx 10MB)");
      return;
    }
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      if (audio.duration > MAX_AUDIO_DURATION) {
        toast.error(`Áudio muito longo (máx ${MAX_AUDIO_DURATION}s)`);
        URL.revokeObjectURL(audio.src);
        return;
      }
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

      // Choose best supported mimeType
      let mimeType = "audio/webm";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "audio/webm;codecs=opus";
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "audio/mp4";
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const ext = mimeType.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `gravação.${ext}`, { type: mimeType });
        const url = URL.createObjectURL(file);

        // Get duration
        const tempAudio = document.createElement("audio");
        tempAudio.preload = "metadata";
        tempAudio.onloadedmetadata = () => {
          const dur = tempAudio.duration;
          setAudioDuration(dur);
          setSelectedAudio(file);
          setAudioPreview(url);
          URL.revokeObjectURL(tempAudio.src);
        };
        tempAudio.src = url;

        // Stop all tracks
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }
        mediaRecorderRef.current = null;
        setIsRecordingAudio(false);
      };

      mediaRecorder.start(1000);
      setIsRecordingAudio(true);
      setRecordingSeconds(0);

      // Timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev + 1 >= MAX_AUDIO_DURATION) {
            stopAudioRecording();
            return MAX_AUDIO_DURATION;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      toast.error("Não foi possível acessar o microfone. Verifique as permissões.");
    }
  };

  const stopAudioRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelAudioRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
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
      toast.error(data.error || "Erro ao enviar vídeo");
      return null;
    } catch { toast.error("Erro ao enviar vídeo"); return null; }
  };

  const uploadAudio = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "posts");
      const res = await fetch("/api/upload/audio", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) return data.url;
      toast.error(data.error || "Erro ao enviar áudio");
      return null;
    } catch { toast.error("Erro ao enviar áudio"); return null; }
  };

  const handlePost = async () => {
    if (!content.trim() || !profile) return;
    const hasMedia = selectedFiles.length > 0 || selectedVideo || selectedAudio;

    if (hasMedia && activeMediaCount >= MAX_ACTIVE_MEDIA_POSTS) {
      toast.error(`Você já tem ${MAX_ACTIVE_MEDIA_POSTS} posts com mídia ativos. Aguarde a expiração.`);
      return;
    }
    if (selectedVideo && videoPostsInWindow >= MAX_VIDEO_POSTS_PER_12H) {
      toast.error(`Você já postou ${MAX_VIDEO_POSTS_PER_12H} vídeos nas últimas 12h.`);
      return;
    }

    setUploading(true);
    try {
      let imageUrls: string[] = [];
      let videoUrl: string | null = null;
      let audioUrl: string | null = null;

      if (selectedFiles.length > 0) {
        imageUrls = await uploadPhotos();
        if (imageUrls.length === 0 && selectedFiles.length > 0) {
          toast.error("Falha ao enviar fotos.");
          setUploading(false);
          return;
        }
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
          content: content.trim(),
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
      toast.success("Post excluído");
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
  const canAddPhotos = !hasVideoInComposer && !hasAudioInComposer && selectedFiles.length < MAX_PHOTOS_PER_POST;
  const canAddVideo = !hasPhotosInComposer && !hasAudioInComposer && !hasVideoInComposer;
  const canAddAudio = !hasPhotosInComposer && !hasVideoInComposer && !hasAudioInComposer;

  if (loading) return <FeedSkeleton />;

  return (
    <div className="space-y-0">
      {/* ═══════ COMPOSER ═══════ */}
      <div className="relative z-10 rounded-3xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03),0_10px_30px_rgba(0,0,0,0.04)]">
        <div className="flex items-start gap-3.5">
          <UserAvatar user={{ id: profile?.id || "", display_name: profile?.display_name || "?", avatar_url: profile?.avatar_url }} className="h-12 w-12 shrink-0" />
          <div className="flex-1 space-y-2">
            <textarea
              placeholder="O que está acontecendo no seu bairro?"
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 500))}
              className="w-full min-h-[72px] resize-none border-0 bg-transparent p-0 text-sm text-[#000305] focus:outline-none placeholder:text-[#01386A]/30"
              rows={2}
            />

            {/* Photo previews */}
            {hasPhotosInComposer && previewUrls.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {previewUrls.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt={`Preview ${i + 1}`} className="h-20 w-20 rounded-2xl object-cover shadow-[0_2px_8px_rgba(0,0,0,0.03),0_10px_30px_rgba(0,0,0,0.04)]" />
                    <button onClick={() => removeSelectedFile(i)} className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#000305] text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Video preview */}
            {hasVideoInComposer && videoPreview && (
              <div className="relative">
                <video src={videoPreview} className="w-full max-h-48 rounded-2xl object-cover" playsInline muted />
                <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-[#f7f75e] px-2 py-0.5 text-[10px] font-semibold text-[#000305]">
                  <Video className="h-3 w-3" /> {formatDuration(videoDuration)}
                </div>
                <button onClick={() => { setSelectedVideo(null); if (videoPreview) URL.revokeObjectURL(videoPreview); setVideoPreview(null); setVideoDuration(0); }} className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#000305] text-white">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Audio preview */}
            {hasAudioInComposer && audioPreview && (
              <div className="relative rounded-2xl bg-[#f7f75e]/[0.08] p-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#000305] text-white">
                    <Music className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-[#000305]">Áudio</span>
                    <span className="text-[10px] text-[#01386A]/40 ml-2">{formatDuration(audioDuration)}</span>
                  </div>
                </div>
                <audio src={audioPreview} controls className="mt-2 w-full h-8" />
                <button onClick={() => { setSelectedAudio(null); if (audioPreview) URL.revokeObjectURL(audioPreview); setAudioPreview(null); setAudioDuration(0); }} className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#000305] text-white">
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            )}

            {/* Audio recording indicator */}
            {isRecordingAudio && (
              <div className="relative rounded-2xl bg-[#01386A]/[0.04] p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#000305] text-white animate-pulse">
                    <Mic className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#01386A]">Gravando áudio...</span>
                      <span className="text-sm font-bold tabular-nums text-[#01386A]">{formatDuration(recordingSeconds)}</span>
                      <span className="text-[10px] text-[#01386A]/40">/ {formatDuration(MAX_AUDIO_DURATION)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 bg-[#01386A]/10 rounded-full overflow-hidden">
                      <div className="h-full bg-[#01386A] rounded-full transition-all" style={{ width: `${(recordingSeconds / MAX_AUDIO_DURATION) * 100}%` }} />
                    </div>
                  </div>
                  <button onClick={stopAudioRecording} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#01386A] text-white shadow-md hover:bg-[#01386A]/90 transition-colors" title="Parar gravação">
                    <Square className="h-4 w-4" />
                  </button>
                  <button onClick={cancelAudioRecording} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f7f9fa] text-[#01386A]/40 hover:bg-[#000305] hover:text-white transition-colors" title="Cancelar">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ═══════ ACTION BAR ═══════ */}
            <div className="flex items-center justify-between pt-1">
              {/* Menu button */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${menuOpen ? "bg-[#f7f75e] text-[#01386A]" : "bg-[#f7f75e] text-[#01386A] hover:bg-[#f7f75e]/80"}`}
                >
                  <Plus className="h-4 w-4" />
                  <span>Menu</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Dropdown menu - opens DOWNWARD */}
                {menuOpen && (
                  <div className="absolute left-0 top-full mt-1 w-56 rounded-2xl bg-white p-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.08),0_10px_30px_rgba(0,0,0,0.06)] z-50 animate-in fade-in-0 zoom-in-95">
                    {/* Camera photo */}
                    <button
                      onClick={() => { if (canAddPhotos) cameraPhotoRef.current?.click(); }}
                      disabled={!canAddPhotos}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors ${canAddPhotos ? "text-[#000305] hover:bg-[#f7f75e]/20" : "text-[#01386A]/25 cursor-not-allowed"}`}
                    >
                      <Camera className={`h-4 w-4 ${canAddPhotos ? "text-[#01386A]" : ""}`} />
                      <span>Tirar foto</span>
                    </button>

                    {/* Gallery photos */}
                    <button
                      onClick={() => { if (canAddPhotos) fileInputRef.current?.click(); }}
                      disabled={!canAddPhotos}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors ${canAddPhotos ? "text-[#000305] hover:bg-[#f7f75e]/20" : "text-[#01386A]/25 cursor-not-allowed"}`}
                    >
                      <ImagePlus className={`h-4 w-4 ${canAddPhotos ? "text-[#01386A]" : ""}`} />
                      <span>Escolher fotos</span>
                    </button>

                    <div className="my-1 h-px bg-[#01386A]/8" />

                    {/* Camera video */}
                    <button
                      onClick={() => { if (canAddVideo && videoPostsInWindow < MAX_VIDEO_POSTS_PER_12H) cameraVideoRef.current?.click(); }}
                      disabled={!canAddVideo || videoPostsInWindow >= MAX_VIDEO_POSTS_PER_12H}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors ${canAddVideo && videoPostsInWindow < MAX_VIDEO_POSTS_PER_12H ? "text-[#000305] hover:bg-[#f7f75e]/20" : "text-[#01386A]/25 cursor-not-allowed"}`}
                    >
                      <Video className={`h-4 w-4 ${canAddVideo && videoPostsInWindow < MAX_VIDEO_POSTS_PER_12H ? "text-[#01386A]" : ""}`} />
                      <span>Gravar vídeo</span>
                    </button>

                    {/* Video from file */}
                    <button
                      onClick={() => { if (canAddVideo && videoPostsInWindow < MAX_VIDEO_POSTS_PER_12H) videoInputRef.current?.click(); }}
                      disabled={!canAddVideo || videoPostsInWindow >= MAX_VIDEO_POSTS_PER_12H}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors ${canAddVideo && videoPostsInWindow < MAX_VIDEO_POSTS_PER_12H ? "text-[#000305] hover:bg-[#f7f75e]/20" : "text-[#01386A]/25 cursor-not-allowed"}`}
                    >
                      <Video className={`h-4 w-4 ${canAddVideo && videoPostsInWindow < MAX_VIDEO_POSTS_PER_12H ? "text-[#01386A]/40" : ""}`} />
                      <span>Escolher vídeo</span>
                    </button>

                    <div className="my-1 h-px bg-[#01386A]/8" />

                    {/* Record audio (direct) */}
                    <button
                      onClick={() => { if (canAddAudio && !isRecordingAudio) startAudioRecording(); }}
                      disabled={!canAddAudio || isRecordingAudio}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors ${canAddAudio && !isRecordingAudio ? "text-[#000305] hover:bg-[#f7f75e]/20" : "text-[#01386A]/25 cursor-not-allowed"}`}
                    >
                      <Mic className={`h-4 w-4 ${canAddAudio && !isRecordingAudio ? "text-[#01386A]" : ""}`} />
                      <span>Gravar áudio</span>
                    </button>

                    {/* Audio from file */}
                    <button
                      onClick={() => { if (canAddAudio) audioInputRef.current?.click(); }}
                      disabled={!canAddAudio}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors ${canAddAudio ? "text-[#000305] hover:bg-[#f7f75e]/20" : "text-[#01386A]/25 cursor-not-allowed"}`}
                    >
                      <Music className={`h-4 w-4 ${canAddAudio ? "text-[#01386A]/40" : ""}`} />
                      <span>Escolher áudio</span>
                    </button>

                    <div className="my-1 h-px bg-[#01386A]/8" />

                    {/* Visibility toggle */}
                    <button
                      onClick={() => setVisibility((v) => v === "public" ? "followers" : "public")}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-[#000305] transition-colors hover:bg-[#f7f75e]/20"
                    >
                      {visibility === "public" ? (
                        <Globe className="h-4 w-4 text-[#01386A]" />
                      ) : (
                        <UsersIcon className="h-4 w-4 text-[#01386A]" />
                      )}
                      <span>{visibility === "public" ? "Público" : "Seguidores"}</span>
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

              {/* Publish button */}
              <div className="flex items-center gap-2">
                <span className={`text-[10px] ${content.length > 450 ? "text-red-500" : "text-[#01386A]/30"}`}>
                  {content.length}/500
                </span>
                <Button size="sm" disabled={!content.trim() || uploading} onClick={handlePost} className="rounded-full px-5 bg-[#01386A] text-white hover:bg-[#01386A]/90 shadow-sm border-0">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publicar"}
                </Button>
              </div>
            </div>

            {activeMediaCount >= MAX_ACTIVE_MEDIA_POSTS && (
              <div className="flex items-center gap-1 text-[10px] text-[#01386A]/50 mt-1">
                <Clock className="h-3 w-3" /> {activeMediaCount}/{MAX_ACTIVE_MEDIA_POSTS} posts com mídia ativos
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Repost dialog */}
      {repostingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#000305]/50 backdrop-blur-sm" onClick={() => { setRepostingPost(null); setRepostContent(""); }}>
          <div className="w-full max-w-md mx-4 rounded-3xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.08),0_10px_30px_rgba(0,0,0,0.06)]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-[#000305] mb-3">Compartilhar no feed</h3>
            <div className="rounded-2xl bg-[#01386A]/[0.04] p-3 mb-3">
              <div className="flex items-center gap-2 mb-1">
                <UserAvatar user={repostingPost.author} className="h-6 w-6" />
                <span className="text-xs font-semibold text-[#000305]">{repostingPost.author.display_name}</span>
                <span className="text-[10px] text-[#01386A]/40">@{repostingPost.author.username}</span>
              </div>
              <p className="text-xs text-[#01386A]/60 line-clamp-3">{repostingPost.content}</p>
            </div>
            <textarea
              placeholder="Adicione um comentário (opcional)..."
              value={repostContent}
              onChange={(e) => setRepostContent(e.target.value.slice(0, 200))}
              className="w-full min-h-[60px] resize-none border-0 bg-transparent p-3 text-sm text-[#000305] focus:outline-none placeholder:text-[#01386A]/30"
              rows={2}
            />
            <div className="flex items-center gap-2 mt-3">
              <Button variant="outline" size="sm" onClick={() => { setRepostingPost(null); setRepostContent(""); }} className="rounded-full border-[#01386A]/10 text-[#01386A]">Cancelar</Button>
              <Button size="sm" onClick={() => handleRepost(repostingPost)} className="rounded-full gap-1.5 bg-[#01386A] text-white hover:bg-[#01386A]/90 border-0">
                <Repeat2 className="h-3.5 w-3.5" /> Compartilhar
              </Button>
            </div>
          </div>
        </div>
      )}

      {posts.length === 0 && (
        <div className="py-16 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#01386A]/[0.04]">
            <MessageCircle className="h-8 w-8 text-[#01386A]/30" />
          </div>
          <p className="text-sm text-[#01386A]/40">Nenhum post ainda. Seja o primeiro a publicar!</p>
        </div>
      )}

      {/* Masonry 2-column grid */}
      <div className="columns-1 sm:columns-2 gap-3.5 mt-4">
        {posts.map((post) => (
          <div key={post.id} className="break-inside-avoid mb-3.5">
            <PostThread
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
          </div>
        ))}
      </div>

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
  const isTextOnly = !hasPhotos && !hasVideo && !hasAudio;

  // Determine card background based on post type
  const cardBg = hasAudio
    ? "bg-[#f7f75e]/[0.08]"
    : isTextOnly
      ? "bg-[#01386A]/[0.04]"
      : "bg-white";
  const commentsBg = hasAudio
    ? "bg-[#f7f75e]/[0.12]"
    : isTextOnly
      ? "bg-[#01386A]/[0.06]"
      : "bg-[#f7f9fa]";

  const [expirationLabel, setExpirationLabel] = useState<string>("");
  useEffect(() => {
    if (!post.expires_at) return;
    const update = () => setExpirationLabel(getExpirationLabel(post.expires_at!));
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [post.expires_at]);

  // Close share menu on outside click
  useEffect(() => {
    if (shareMenuOpen !== post.id) return;
    const handler = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareMenuOpen(null);
      }
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
    if (!showComments) {
      if (comments.length === 0) fetchComments();
      setShowComments(true);
    }
    setTimeout(() => commentInputRef.current?.focus(), 100);
  };

  const handleReply = (comment: Comment) => {
    setReplyTo(comment);
    if (!showComments) {
      if (comments.length === 0) fetchComments();
      setShowComments(true);
    }
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
      if (data.success) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        onUpdateCommentCount(post.id, -1);
      }
    } catch { toast.error("Erro ao excluir comentário"); }
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
    <div className={`rounded-3xl ${cardBg} shadow-[0_2px_8px_rgba(0,0,0,0.03),0_10px_30px_rgba(0,0,0,0.04)] overflow-hidden transition-shadow hover:shadow-[0_4px_12px_rgba(0,0,0,0.04),0_14px_40px_rgba(0,0,0,0.06)] ${isOwnPost ? "border-l-4 border-l-[#f7f75e]" : ""}`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <button onClick={() => openUserProfile?.(post.author.id)} className="shrink-0 group">
            <UserAvatar user={post.author} className="h-11 w-11 hover:opacity-80 transition-opacity ring-2 ring-white/50 shadow-sm" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => openUserProfile?.(post.author.id)} className="text-sm font-semibold text-[#000305] hover:underline underline-offset-2 transition-all">
                {post.author.display_name}
              </button>
              <span className="text-xs text-[#01386A]/40">@{post.author.username}</span>
              {post.author.neighborhood && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-[#01386A] px-2 py-0.5 text-[10px] font-medium text-white">
                  <MapPin className="h-2.5 w-2.5" />{post.author.neighborhood}
                </span>
              )}
              {post.visibility === "followers" && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-[#f7f75e] px-2 py-0.5 text-[10px] font-semibold text-[#000305]">
                  <UsersIcon className="h-2.5 w-2.5" />Seguidores
                </span>
              )}
              {isOwnPost && (
                <span className="inline-flex items-center rounded-full bg-[#f7f75e]/30 px-2 py-0.5 text-[10px] font-medium text-[#01386A]">
                  Seu post
                </span>
              )}
              <span className="text-[10px] text-[#01386A]/25">·</span>
              <span className="text-[10px] text-[#01386A]/40">{timeAgo(post.created_at)}</span>
            </div>

            {/* Content */}
            {isTextOnly ? (
              <p className="mt-2 font-serif text-lg leading-snug whitespace-pre-wrap text-[#000305]">{post.content}</p>
            ) : (
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-[#000305]">{post.content}</p>
            )}

            {/* Shared post (repost) */}
            {post.shared_post && (
              <div className="mt-2.5 rounded-2xl bg-[#01386A]/[0.04] p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Repeat2 className="h-3 w-3 text-[#01386A]/40" />
                  <span className="text-[10px] text-[#01386A]/40">Compartilhado de</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <button onClick={() => openUserProfile?.(post.shared_post!.author.id)} className="shrink-0">
                    <UserAvatar user={post.shared_post.author} className="h-6 w-6" />
                  </button>
                  <button onClick={() => openUserProfile?.(post.shared_post!.author.id)} className="text-xs font-semibold text-[#000305] hover:underline">
                    {post.shared_post.author.display_name}
                  </button>
                  <span className="text-[10px] text-[#01386A]/40">@{post.shared_post.author.username}</span>
                </div>
                <p className="text-xs text-[#01386A]/60 leading-relaxed line-clamp-4">{post.shared_post.content}</p>
                {post.shared_post.image_urls && post.shared_post.image_urls.length > 0 && (
                  <div className="mt-1.5 flex gap-1 overflow-x-auto">
                    {post.shared_post.image_urls.slice(0, 2).map((url, i) => (
                      <img key={i} src={url} alt="" className="h-16 w-16 rounded-xl object-cover shrink-0" />
                    ))}
                    {post.shared_post.image_urls.length > 2 && (
                      <div className="h-16 w-16 rounded-xl bg-[#01386A]/[0.04] flex items-center justify-center text-xs text-[#01386A]/40 shrink-0">
                        +{post.shared_post.image_urls.length - 2}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Media */}
            {hasPhotos && <PhotoGrid photos={post.image_urls!} onPhotoClick={onPhotoClick} />}
            {hasVideo && <VideoPlayer src={post.video_url!} />}
            {hasAudio && <AudioPlayer src={post.audio_url!} />}

            {/* Expiration */}
            {post.expires_at && expirationLabel && (
              <div className="mt-2.5 flex items-center gap-1.5 text-[10px] font-semibold text-[#000305] bg-[#f7f75e] rounded-full px-2.5 py-1 w-fit">
                <Clock className="h-3 w-3" />
                <span>{expirationLabel}</span>
              </div>
            )}

            {/* ═══════ ACTION BAR ═══════ */}
            <div className="mt-3 flex items-center gap-0.5">
              {/* Reactions */}
              <div className="relative">
                <button
                  onClick={() => setShowReactions(!showReactions)}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs transition-colors ${post.reactions?.some((r) => r.user_id === profile?.id) ? "text-[#01386A] bg-[#01386A]/10 font-medium" : "text-[#01386A]/40 hover:bg-[#01386A]/[0.04] hover:text-[#01386A]"}`}
                >
                  <Heart className="h-4 w-4" />
                  {post.reactions?.length > 0 && <span>{post.reactions.length}</span>}
                </button>
                {showReactions && (
                  <div className="absolute bottom-full left-0 mb-1.5 flex gap-0.5 rounded-2xl bg-white p-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.08),0_10px_30px_rgba(0,0,0,0.06)] z-20">
                    {REACTION_EMOJIS.map(({ type, emoji, label }) => {
                      const isActive = post.reactions?.some((r) => r.user_id === profile?.id && r.type === type);
                      return (
                        <button
                          key={type}
                          onClick={() => { onReaction(post.id, type); setShowReactions(false); }}
                          className={`rounded-xl p-1.5 text-lg transition-all hover:scale-125 ${isActive ? "bg-[#01386A]/10 ring-1 ring-[#01386A]" : ""}`}
                          title={label}
                        >
                          {emoji}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Reaction summary pills */}
              {reactionGroups.length > 0 && (
                <div className="flex gap-0.5 ml-0.5">
                  {reactionGroups.slice(0, 3).map((g, i) => (
                    <span key={i} className="inline-flex items-center gap-0.5 rounded-full bg-[#01386A]/[0.06] px-1.5 py-0.5 text-[10px]">
                      {g.emoji} {g.count}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex-1" />

              {/* Comment */}
              <button onClick={openAndFocus} className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-[#01386A]/40 transition-colors hover:bg-[#01386A]/[0.04] hover:text-[#01386A]">
                <MessageCircle className="h-4 w-4" />
                {commentCount > 0 && commentCount}
              </button>

              {/* Share/Repost */}
              <div className="relative" ref={shareRef}>
                <button
                  onClick={() => setShareMenuOpen(shareMenuOpen === post.id ? null : post.id)}
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-[#01386A]/40 transition-colors hover:bg-[#01386A]/[0.04] hover:text-[#01386A]"
                >
                  <Share2 className="h-4 w-4" />
                </button>
                {shareMenuOpen === post.id && (
                  <ShareMenu
                    post={post}
                    onClose={() => setShareMenuOpen(null)}
                    onRepost={onRepost}
                  />
                )}
              </div>

              {/* Delete (own posts only) */}
              {isOwnPost && (
                <button onClick={() => onDelete(post.id)} className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs text-[#01386A]/30 transition-colors hover:bg-red-50 hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Comments toggle */}
      {(commentCount > 0 || comments.length > 0) && (
        <button onClick={toggleComments} className="flex w-full items-center justify-center gap-1.5 py-2.5 text-xs text-[#01386A]/40 transition-colors hover:bg-[#01386A]/[0.02] hover:text-[#01386A]">
          {showComments ? <>Ocultar comentários <ChevronUp className="h-3 w-3" /></> : <>{commentCount || comments.length} comentário{(commentCount || comments.length) !== 1 ? "s" : ""} <ChevronDown className="h-3 w-3" /></>}
        </button>
      )}

      {/* Comments section */}
      {showComments && (
        <div className={`${commentsBg}`}>
          <div className="max-h-72 overflow-y-auto px-4 py-3 custom-scrollbar">
            {commentsLoading ? (
              <div className="space-y-3">{[1, 2].map((i) => (<div key={i} className="flex gap-2.5 animate-pulse"><div className="h-6 w-6 rounded-full bg-[#01386A]/8" /><div className="flex-1 space-y-1.5"><div className="h-3 w-24 rounded bg-[#01386A]/8" /><div className="h-3 w-full rounded bg-[#01386A]/8" /></div></div>))}</div>
            ) : comments.length === 0 ? (
              <p className="text-xs text-center text-[#01386A]/30 py-2">Nenhum comentário ainda</p>
            ) : (
              commentRoots.map((root) => (
                <CommentItem
                  key={root.id}
                  comment={root}
                  profile={profile}
                  replies={commentMap.get(root.id) || []}
                  commentMap={commentMap}
                  onReply={handleReply}
                  onDelete={deleteComment}
                  onReaction={handleCommentReaction}
                  openUserProfile={openUserProfile}
                />
              ))
            )}
          </div>

          {/* Comment input */}
          <div className="px-4 pb-3">
            {replyTo && (
              <div className="flex items-center gap-1.5 mb-1.5 text-[10px] text-[#01386A]/50">
                <Reply className="h-3 w-3" />
                <span>Respondendo a <strong>{replyTo.author.display_name}</strong></span>
                <button onClick={() => setReplyTo(null)} className="ml-1 text-[#01386A]/30 hover:text-[#01386A]"><X className="h-3 w-3" /></button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Input
                ref={commentInputRef}
                placeholder="Escreva um comentário..."
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value.slice(0, 300))}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                className="flex-1 h-9 rounded-full border-[#01386A]/10 bg-white text-sm focus:border-[#01386A]/30 focus:ring-[#01386A]/10 placeholder:text-[#01386A]/30"
                disabled={submitting}
              />
              <button
                onClick={submitComment}
                disabled={!commentInput.trim() || submitting}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#01386A] text-white transition-colors hover:bg-[#01386A]/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick comment (when comments hidden) */}
      {!showComments && profile && (
        <div className="flex items-center gap-2 px-4 py-2.5">
          <UserAvatar user={{ id: profile.id, display_name: profile.display_name, avatar_url: profile.avatar_url }} className="h-6 w-6 shrink-0" />
          <Input placeholder="Escreva um comentário..." value={commentInput} onChange={(e) => setCommentInput(e.target.value.slice(0, 300))} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && commentInput.trim()) openAndFocus(); }} onFocus={openAndFocus} className="h-8 text-xs border-0 bg-white/60 focus-visible:ring-1 focus-visible:ring-[#01386A]/20 placeholder:text-[#01386A]/30" />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CommentItem
// ═══════════════════════════════════════════════════════════
function CommentItem({
  comment, profile, replies, commentMap, onReply, onDelete, onReaction, openUserProfile,
}: {
  comment: Comment;
  profile: Profile | null;
  replies: Comment[];
  commentMap: Map<string, Comment[]>;
  onReply: (comment: Comment) => void;
  onDelete: (commentId: string) => void;
  onReaction: (commentId: string, type: string) => void;
  openUserProfile?: (userId: string) => void;
}) {
  const [showReactions, setShowReactions] = useState(false);
  const isOwnComment = comment.author_id === profile?.id;

  return (
    <div className="flex gap-2.5 py-1.5">
      <button onClick={() => openUserProfile?.(comment.author.id)} className="shrink-0">
        <UserAvatar user={comment.author} className="h-6 w-6" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => openUserProfile?.(comment.author.id)} className="text-[11px] font-semibold text-[#000305] hover:underline">
            {comment.author.display_name}
          </button>
          <span className="text-[10px] text-[#01386A]/40">@{comment.author.username}</span>
          <span className="text-[10px] text-[#01386A]/25">·</span>
          <span className="text-[10px] text-[#01386A]/40">{timeAgo(comment.created_at)}</span>
        </div>
        <p className="text-xs leading-relaxed text-[#000305]/80 mt-0.5">{comment.content}</p>
        <div className="flex items-center gap-2 mt-1">
          {/* Reactions */}
          <div className="relative">
            <button
              onClick={() => setShowReactions(!showReactions)}
              className="text-[10px] text-[#01386A]/30 hover:text-[#01386A] transition-colors"
            >
              {comment.reactions?.length > 0 ? (
                <span className="inline-flex items-center gap-0.5">
                  {buildReactionGroups(comment.reactions).slice(0, 2).map((g, i) => (
                    <span key={i}>{g.emoji}</span>
                  ))}
                  <span className="ml-0.5">{comment.reactions.length}</span>
                </span>
              ) : (
                <Heart className="h-3 w-3" />
              )}
            </button>
            {showReactions && (
              <div className="absolute bottom-full left-0 mb-1 flex gap-0.5 rounded-2xl bg-white p-1 shadow-[0_2px_8px_rgba(0,0,0,0.08),0_10px_30px_rgba(0,0,0,0.06)] z-20">
                {REACTION_EMOJIS.map(({ type, emoji, label }) => {
                  const isActive = comment.reactions?.some((r) => r.user_id === profile?.id && r.type === type);
                  return (
                    <button
                      key={type}
                      onClick={() => { onReaction(comment.id, type); setShowReactions(false); }}
                      className={`rounded-lg p-1 text-sm transition-all hover:scale-125 ${isActive ? "bg-[#01386A]/10 ring-1 ring-[#01386A]" : ""}`}
                      title={label}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button onClick={() => onReply(comment)} className="text-[10px] text-[#01386A]/30 hover:text-[#01386A] transition-colors">Responder</button>
          {isOwnComment && (
            <button onClick={() => onDelete(comment.id)} className="text-[10px] text-[#01386A]/20 hover:text-red-500 transition-colors">Excluir</button>
          )}
        </div>

        {/* Nested replies */}
        {replies.length > 0 && (
          <div className="mt-1.5 border-l-2 border-[#01386A]/20 pl-3 space-y-1.5">
            {replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                profile={profile}
                replies={commentMap.get(reply.id) || []}
                commentMap={commentMap}
                onReply={onReply}
                onDelete={onDelete}
                onReaction={onReaction}
                openUserProfile={openUserProfile}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// FeedSkeleton
// ═══════════════════════════════════════════════════════════
function FeedSkeleton() {
  return (
    <div className="space-y-0">
      {/* Composer skeleton */}
      <div className="rounded-3xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03),0_10px_30px_rgba(0,0,0,0.04)]">
        <div className="flex items-start gap-3.5 animate-pulse">
          <div className="h-12 w-12 rounded-full bg-[#01386A]/8" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-full rounded bg-[#01386A]/6" />
            <div className="h-4 w-3/4 rounded bg-[#01386A]/6" />
          </div>
        </div>
      </div>

      {/* Post skeletons */}
      <div className="columns-1 sm:columns-2 gap-3.5 mt-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="break-inside-avoid mb-3.5">
            <div className="rounded-3xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.03),0_10px_30px_rgba(0,0,0,0.04)] p-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-full bg-[#01386A]/8" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-20 rounded bg-[#01386A]/8" />
                    <div className="h-3 w-14 rounded bg-[#01386A]/6" />
                  </div>
                  <div className="h-3 w-full rounded bg-[#01386A]/6" />
                  <div className="h-3 w-4/5 rounded bg-[#01386A]/6" />
                  <div className="h-28 w-full rounded-2xl bg-[#01386A]/6" />
                  <div className="flex items-center gap-3 mt-2">
                    <div className="h-4 w-10 rounded bg-[#01386A]/6" />
                    <div className="h-4 w-10 rounded bg-[#01386A]/6" />
                    <div className="h-4 w-10 rounded bg-[#01386A]/6" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
