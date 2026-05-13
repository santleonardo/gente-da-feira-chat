"use client";

// ============================================================
// PhotoGallery - Galeria de fotos e vídeos do perfil
// Máximo: 20 fotos + 5 vídeos por perfil
// Com reações e comentários em cada foto
// ============================================================

import { useState, useEffect, useRef } from "react";
import { useStore, Profile } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ImagePlus,
  X,
  Heart,
  MessageCircle,
  Trash2,
  Send,
  Reply,
  Loader2,
  Camera,
  Video,
  Play,
  Upload,
} from "lucide-react";
import { UserAvatar } from "./UserAvatar";
import { timeAgo } from "@/lib/constants";
import { toast } from "sonner";
import {
  compressImage,
  validateImageFile,
  createPreviewUrl,
  revokePreviewUrl,
} from "@/lib/image-compression";

const MAX_PHOTOS_PER_PROFILE = 20;
const MAX_VIDEOS_PER_PROFILE = 5;
const MAX_VIDEO_SIZE_MB = 50;
const MAX_VIDEO_DURATION_SEC = 30;

const REACTION_EMOJIS = [
  { type: "like", emoji: "❤️", label: "Curtir" },
  { type: "laugh", emoji: "😂", label: "Engraçado" },
  { type: "sad", emoji: "😔", label: "Triste" },
  { type: "wow", emoji: "😲", label: "Uau" },
  { type: "angry", emoji: "😡", label: "Bravo" },
  { type: "love", emoji: "😍", label: "Amei" },
] as const;

interface ProfilePhoto {
  id: string;
  user_id: string;
  url: string;
  caption: string;
  storage_path: string;
  created_at: string;
  reactions: { user_id: string; type: string }[];
  comment_count: number;
}

interface ProfileVideo {
  id: string;
  user_id: string;
  url: string;
  storage_path: string;
  thumbnail_url: string;
  duration: number;
  created_at: string;
}

interface PhotoComment {
  id: string;
  photo_id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  author: {
    id: string;
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
}

// ═══════════════════════════════════════════════════════════
// PhotoGallery - Componente principal
// ═══════════════════════════════════════════════════════════
export function PhotoGallery({
  userId,
  isOwnProfile = false,
}: {
  userId: string;
  isOwnProfile?: boolean;
}) {
  const { profile } = useStore();
  const [photos, setPhotos] = useState<ProfilePhoto[]>([]);
  const [videos, setVideos] = useState<ProfileVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<ProfilePhoto | null>(null);
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"fotos" | "videos">("fotos");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPhotos();
    fetchVideos();
  }, [userId]);

  const fetchPhotos = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/profile-photos?userId=${userId}`);
      const data = await res.json();
      if (data.photos) setPhotos(data.photos);
    } catch { /* silent */ }
    setLoading(false);
  };

  const fetchVideos = async () => {
    try {
      const res = await fetch(`/api/profile-videos?userId=${userId}`);
      const data = await res.json();
      if (data.videos) setVideos(data.videos);
    } catch { /* silent */ }
  };

  // ── Generate thumbnail from video client-side ──
  const generateVideoThumbnail = (file: File): Promise<{ thumbnailBlob: Blob; duration: number }> => {
    return new Promise((resolve, reject) => {
      const videoEl = document.createElement("video");
      videoEl.preload = "metadata";
      videoEl.muted = true;
      videoEl.playsInline = true;

      const url = URL.createObjectURL(file);
      videoEl.src = url;

      let videoDuration = 0;

      videoEl.onloadedmetadata = () => {
        videoDuration = videoEl.duration;

        if (videoDuration > MAX_VIDEO_DURATION_SEC) {
          URL.revokeObjectURL(url);
          reject(new Error(`Vídeo muito longo. Máximo ${MAX_VIDEO_DURATION_SEC} segundos.`));
          return;
        }

        // Seek to 1 second for thumbnail (or 0 if very short)
        videoEl.currentTime = Math.min(1, videoDuration * 0.1);
      };

      videoEl.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 320;
          canvas.height = 240;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas context error");
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(url);
              if (blob) {
                resolve({ thumbnailBlob: blob, duration: videoDuration });
              } else {
                reject(new Error("Erro ao gerar thumbnail"));
              }
            },
            "image/webp",
            0.7
          );
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };

      videoEl.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Erro ao carregar vídeo"));
      };
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    const error = validateImageFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    if (photos.length >= MAX_PHOTOS_PER_PROFILE) {
      toast.error(`Limite de ${MAX_PHOTOS_PER_PROFILE} fotos atingido. Remova uma foto primeiro.`);
      return;
    }

    setUploading(true);
    try {
      const compressed = await compressImage(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.55,
        maxSizeKB: 150,
      });

      const formData = new FormData();
      formData.append("file", compressed, "photo.webp");
      formData.append("folder", "gallery");

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadData.url) {
        toast.error(uploadData.error || "Erro ao enviar foto");
        setUploading(false);
        return;
      }

      const saveRes = await fetch("/api/profile-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: uploadData.url,
          caption: "",
          storagePath: uploadData.path,
        }),
      });
      const saveData = await saveRes.json();

      if (saveData.photo) {
        setPhotos((prev) => [saveData.photo, ...prev]);
        toast.success("Foto adicionada!");
      } else {
        toast.error(saveData.error || "Erro ao salvar foto");
      }
    } catch {
      toast.error("Erro ao enviar foto");
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    // Validate video type
    const allowedVideoTypes = ["video/mp4", "video/webm"];
    if (!allowedVideoTypes.includes(file.type)) {
      toast.error("Formato não suportado. Use MP4 ou WebM.");
      return;
    }

    // Validate size
    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      toast.error(`Vídeo muito grande. Máximo ${MAX_VIDEO_SIZE_MB}MB.`);
      return;
    }

    if (videos.length >= MAX_VIDEOS_PER_PROFILE) {
      toast.error(`Limite de ${MAX_VIDEOS_PER_PROFILE} vídeos atingido. Remova um vídeo primeiro.`);
      return;
    }

    setUploadingVideo(true);
    try {
      // Generate thumbnail client-side
      const { thumbnailBlob, duration } = await generateVideoThumbnail(file);

      // Upload video
      const videoFormData = new FormData();
      videoFormData.append("file", file, file.name);
      videoFormData.append("folder", "videos");

      const videoUploadRes = await fetch("/api/upload/video", {
        method: "POST",
        body: videoFormData,
      });
      const videoUploadData = await videoUploadRes.json();

      if (!videoUploadData.url) {
        toast.error(videoUploadData.error || "Erro ao enviar vídeo");
        setUploadingVideo(false);
        return;
      }

      // Upload thumbnail
      const thumbFormData = new FormData();
      thumbFormData.append("file", thumbnailBlob, "thumbnail.webp");
      thumbFormData.append("folder", "video-thumbs");

      const thumbUploadRes = await fetch("/api/upload", {
        method: "POST",
        body: thumbFormData,
      });
      const thumbUploadData = await thumbUploadRes.json();

      const thumbnailUrl = thumbUploadData.url || "";

      // Save video record
      const saveRes = await fetch("/api/profile-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: videoUploadData.url,
          storagePath: videoUploadData.path,
          thumbnailUrl,
          duration,
        }),
      });
      const saveData = await saveRes.json();

      if (saveData.video) {
        setVideos((prev) => [saveData.video, ...prev]);
        toast.success("Vídeo adicionado!");
      } else {
        toast.error(saveData.error || "Erro ao salvar vídeo");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar vídeo");
    }
    setUploadingVideo(false);
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const handleDelete = async (photoId: string) => {
    try {
      const res = await fetch(`/api/profile-photos?id=${photoId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
        setSelectedPhoto(null);
        toast.success("Foto removida");
      } else {
        toast.error(data.error || "Erro ao remover");
      }
    } catch {
      toast.error("Erro ao remover foto");
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    try {
      const res = await fetch(`/api/profile-videos?id=${videoId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setVideos((prev) => prev.filter((v) => v.id !== videoId));
        toast.success("Vídeo removido");
      } else {
        toast.error(data.error || "Erro ao remover vídeo");
      }
    } catch {
      toast.error("Erro ao remover vídeo");
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-1.5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Header with tabs */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-3">
          <button
            onClick={() => setActiveTab("fotos")}
            className={`text-sm font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === "fotos" ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            <Camera className="h-4 w-4" />
            Fotos
            <span className="font-normal text-muted-foreground">
              ({photos.length}/{MAX_PHOTOS_PER_PROFILE})
            </span>
          </button>
          <button
            onClick={() => setActiveTab("videos")}
            className={`text-sm font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === "videos" ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            <Video className="h-4 w-4" />
            Vídeos
            <span className="font-normal text-muted-foreground">
              ({videos.length}/{MAX_VIDEOS_PER_PROFILE})
            </span>
          </button>
        </div>
        {isOwnProfile && (
          <div className="flex gap-2">
            {activeTab === "fotos" && photos.length < MAX_PHOTOS_PER_PROFILE && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-3.5 w-3.5" />
                  )}
                  {uploading ? "Enviando..." : "Adicionar"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleUpload}
                  className="hidden"
                />
              </>
            )}
            {activeTab === "videos" && videos.length < MAX_VIDEOS_PER_PROFILE && (
              <>
                <button
                  onClick={() => videoInputRef.current?.click()}
                  disabled={uploadingVideo}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  {uploadingVideo ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {uploadingVideo ? "Enviando..." : "Adicionar vídeo"}
                </button>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/webm"
                  onChange={handleVideoUpload}
                  className="hidden"
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Photos Tab */}
      {activeTab === "fotos" && (
        <>
          {photos.length === 0 ? (
            <div className="py-8 text-center">
              <Camera className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                {isOwnProfile
                  ? "Nenhuma foto ainda. Toque em adicionar!"
                  : "Nenhuma foto ainda"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => setSelectedPhoto(photo)}
                  className="relative aspect-square overflow-hidden rounded-lg group"
                >
                  <img
                    src={photo.url}
                    alt="Foto do perfil"
                    className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                    loading="lazy"
                  />
                  {(photo.reactions?.length > 0 || photo.comment_count > 0) && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                      {photo.reactions?.length > 0 && (
                        <span className="text-white text-xs flex items-center gap-0.5">
                          ❤️ {photo.reactions.length}
                        </span>
                      )}
                      {photo.comment_count > 0 && (
                        <span className="text-white text-xs flex items-center gap-0.5">
                          💬 {photo.comment_count}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Videos Tab */}
      {activeTab === "videos" && (
        <>
          {videos.length === 0 ? (
            <div className="py-8 text-center">
              <Video className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                {isOwnProfile
                  ? "Nenhum vídeo ainda. Toque em adicionar!"
                  : "Nenhum vídeo ainda"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {videos.map((video) => (
                <div key={video.id} className="relative group">
                  <button
                    onClick={() => setVideoModalUrl(video.url)}
                    className="relative overflow-hidden rounded-lg w-full"
                  >
                    {video.thumbnail_url ? (
                      <img
                        src={video.thumbnail_url}
                        alt="Vídeo"
                        className="w-full aspect-video object-cover group-hover:opacity-80 transition-opacity"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full aspect-video bg-muted flex items-center justify-center">
                        <Play className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    {/* Play icon overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-10 w-10 rounded-full bg-white/80 flex items-center justify-center shadow">
                        <Play className="h-4 w-4 text-foreground ml-0.5" fill="currentColor" />
                      </div>
                    </div>
                    {/* Duration badge */}
                    {video.duration > 0 && (
                      <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] px-1 py-0.5 rounded">
                        {Math.floor(video.duration / 60)}:{String(Math.floor(video.duration % 60)).padStart(2, "0")}
                      </span>
                    )}
                  </button>
                  {/* Delete button */}
                  {isOwnProfile && (
                    <button
                      onClick={() => {
                        if (confirm("Remover este vídeo?")) handleDeleteVideo(video.id);
                      }}
                      className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Photo detail modal */}
      {selectedPhoto && (
        <PhotoDetailModal
          photo={selectedPhoto}
          isOwnProfile={isOwnProfile}
          onClose={() => setSelectedPhoto(null)}
          onDelete={handleDelete}
          onReactionUpdate={(photoId, reactions) => {
            setPhotos((prev) =>
              prev.map((p) =>
                p.id === photoId ? { ...p, reactions } : p
              )
            );
            setSelectedPhoto((prev) =>
              prev?.id === photoId ? { ...prev, reactions } : prev
            );
          }}
          onCommentAdded={(photoId) => {
            setPhotos((prev) =>
              prev.map((p) =>
                p.id === photoId
                  ? { ...p, comment_count: (p.comment_count || 0) + 1 }
                  : p
              )
            );
            setSelectedPhoto((prev) =>
              prev?.id === photoId
                ? { ...prev, comment_count: (prev.comment_count || 0) + 1 }
                : prev
            );
          }}
        />
      )}

      {/* Video player modal */}
      {videoModalUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setVideoModalUrl(null)}
        >
          <button
            onClick={() => setVideoModalUrl(null)}
            className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <video
            src={videoModalUrl}
            controls
            autoPlay
            className="max-h-[90vh] max-w-[95vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PhotoDetailModal - Visualizar foto com reações e comentários
// ═══════════════════════════════════════════════════════════
function PhotoDetailModal({
  photo,
  isOwnProfile,
  onClose,
  onDelete,
  onReactionUpdate,
  onCommentAdded,
}: {
  photo: ProfilePhoto;
  isOwnProfile: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
  onReactionUpdate: (photoId: string, reactions: { user_id: string; type: string }[]) => void;
  onCommentAdded: (photoId: string) => void;
}) {
  const { profile } = useStore();
  const [comments, setComments] = useState<PhotoComment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<PhotoComment | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchComments();
  }, [photo.id]);

  const fetchComments = async () => {
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/profile-photos/comments?photoId=${photo.id}`);
      const data = await res.json();
      if (data.comments) setComments(data.comments);
    } catch { /* silent */ }
    setCommentsLoading(false);
  };

  const handleReaction = async (type: string) => {
    if (!profile) return;
    try {
      const res = await fetch("/api/profile-photos/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: photo.id, type }),
      });
      const data = await res.json();
      if (data.reacted !== undefined) {
        const newReactions = data.reacted
          ? [...(photo.reactions || []), { user_id: profile.id, type }]
          : (photo.reactions || []).filter(
              (r) => !(r.user_id === profile.id && r.type === type)
            );
        onReactionUpdate(photo.id, newReactions);
      }
    } catch { /* silent */ }
  };

  const submitComment = async () => {
    if (!commentInput.trim() || !profile || submitting) return;
    setSubmitting(true);
    try {
      const body: { photoId: string; content: string; parentId?: string } = {
        photoId: photo.id,
        content: commentInput.trim(),
      };
      if (replyTo) body.parentId = replyTo.id;

      const res = await fetch("/api/profile-photos/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.comment) {
        setComments((prev) => [...prev, data.comment]);
        setCommentInput("");
        setReplyTo(null);
        onCommentAdded(photo.id);
      } else if (data.error) {
        toast.error(data.error);
      }
    } catch {
      toast.error("Erro ao comentar");
    }
    setSubmitting(false);
  };

  const deleteComment = async (commentId: string) => {
    try {
      const res = await fetch(
        `/api/profile-photos/comments?commentId=${commentId}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.success) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      }
    } catch { /* silent */ }
  };

  const commentMap = new Map<string, PhotoComment[]>();
  const commentRoots: PhotoComment[] = [];
  for (const c of comments) {
    if (c.parent_id) {
      const children = commentMap.get(c.parent_id) || [];
      children.push(c);
      commentMap.set(c.parent_id, children);
    } else {
      commentRoots.push(c);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="bg-background w-full sm:max-w-md sm:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-semibold">Foto</span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Imagem */}
        <div className="bg-black/5 flex-shrink-0">
          <img
            src={photo.url}
            alt="Foto do perfil"
            className="w-full max-h-64 object-contain"
          />
        </div>

        {/* Reações */}
        <div className="flex items-center gap-2 px-4 py-2 border-b flex-wrap">
          {REACTION_EMOJIS.map(({ type, emoji, label }) => {
            const isActive = photo.reactions?.some(
              (r) => r.user_id === profile?.id && r.type === type
            );
            const count =
              photo.reactions?.filter((r) => r.type === type).length || 0;
            return (
              <button
                key={type}
                onClick={() => handleReaction(type)}
                className={`flex items-center gap-0.5 text-xs transition-colors ${
                  isActive ? "text-primary font-semibold" : "hover:text-primary"
                }`}
                title={label}
              >
                <span className="text-sm">{emoji}</span>
                {count > 0 && <span>{count}</span>}
              </button>
            );
          })}

          <span className="text-xs text-muted-foreground ml-1">
            <MessageCircle className="h-3.5 w-3.5 inline" /> {photo.comment_count || 0}
          </span>

          <span className="text-[10px] text-muted-foreground ml-auto">
            {timeAgo(photo.created_at)}
          </span>

          {isOwnProfile && (
            <button
              onClick={() => {
                if (confirm("Remover esta foto?")) onDelete(photo.id);
              }}
              className="text-muted-foreground hover:text-destructive transition-colors ml-1"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Comentários */}
        <div className="flex-1 overflow-y-auto px-4 py-3 max-h-48">
          {commentsLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="flex gap-2 animate-pulse">
                  <div className="h-5 w-5 rounded-full bg-muted" />
                  <div className="flex-1 space-y-1">
                    <div className="h-2.5 w-20 rounded bg-muted" />
                    <div className="h-2.5 w-full rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-2">
              Nenhum comentário ainda
            </p>
          ) : (
            <div className="space-y-2.5">
              {commentRoots.map((comment) => (
                <PhotoCommentItem
                  key={comment.id}
                  comment={comment}
                  replies={commentMap.get(comment.id) || []}
                  commentMap={commentMap}
                  profile={profile}
                  onDelete={deleteComment}
                  onReply={(c) => {
                    setReplyTo(c);
                    commentInputRef.current?.focus();
                  }}
                  depth={0}
                />
              ))}
            </div>
          )}
        </div>

        {/* Input de comentário */}
        {profile && (
          <div className="border-t px-4 py-2.5">
            {replyTo && (
              <div className="flex items-center gap-1.5 mb-1 text-[10px] text-muted-foreground">
                <Reply className="h-2.5 w-2.5" />
                <span>
                  Respondendo a <strong>@{replyTo.author.display_name}</strong>
                </span>
                <button
                  onClick={() => setReplyTo(null)}
                  className="text-destructive hover:underline ml-1"
                >
                  Cancelar
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <UserAvatar
                user={{
                  id: profile.id,
                  display_name: profile.display_name,
                  avatar_url: profile.avatar_url,
                }}
                className="h-5 w-5 shrink-0"
              />
              <Input
                ref={commentInputRef}
                placeholder={
                  replyTo
                    ? `Responder @${replyTo.author.display_name}...`
                    : "Comentar..."
                }
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value.slice(0, 300))}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && submitComment()
                }
                className="h-7 text-xs border-0 bg-muted/50 focus-visible:ring-1"
              />
              <Button
                size="icon"
                onClick={submitComment}
                disabled={!commentInput.trim() || submitting}
                className="h-7 w-7 shrink-0 rounded-full"
              >
                <Send className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PhotoCommentItem - Comentário em foto
// ═══════════════════════════════════════════════════════════
function PhotoCommentItem({
  comment,
  replies,
  commentMap,
  profile,
  onDelete,
  onReply,
  depth,
}: {
  comment: PhotoComment;
  replies: PhotoComment[];
  commentMap: Map<string, PhotoComment[]>;
  profile: Profile | null;
  onDelete: (id: string) => void;
  onReply: (comment: PhotoComment) => void;
  depth: number;
}) {
  return (
    <div className={depth > 0 ? "ml-5 border-l-2 border-muted pl-2" : ""}>
      <div className="flex gap-2">
        <UserAvatar
          user={{
            id: comment.author.id,
            display_name: comment.author.display_name,
            avatar_url: comment.author.avatar_url,
          }}
          className="h-5 w-5 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold">
              {comment.author.display_name}
            </span>
            <span className="text-[9px] text-muted-foreground">
              {timeAgo(comment.created_at)}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed">{comment.content}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <button
              onClick={() => onReply(comment)}
              className="text-[9px] text-muted-foreground hover:text-primary transition-colors"
            >
              Responder
            </button>
            {comment.user_id === profile?.id && (
              <button
                onClick={() => onDelete(comment.id)}
                className="text-[9px] text-muted-foreground hover:text-destructive"
              >
                Excluir
              </button>
            )}
          </div>
        </div>
      </div>
      {replies.map((reply) => (
        <PhotoCommentItem
          key={reply.id}
          comment={reply}
          replies={commentMap.get(reply.id) || []}
          commentMap={commentMap}
          profile={profile}
          onDelete={onDelete}
          onReply={onReply}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}
