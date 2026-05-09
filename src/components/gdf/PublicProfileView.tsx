"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, MessageCircle, Heart, ArrowLeft } from "lucide-react";
import { getInitials, getAvatarColor, timeAgo } from "@/lib/constants";
import { toast } from "sonner";

interface PublicProfileViewProps {
  userId: string;
  onBack: () => void;
}

export function PublicProfileView({ userId, onBack }: PublicProfileViewProps) {
  const { profile } = useStore();
  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/users/${userId}`).then((r) => r.json()),
      fetch(`/api/users/${userId}/posts`).then((r) => r.json()),
    ])
      .then(([userData, postData]) => {
        if (userData.user) setUser(userData.user);
        setPosts(postData.posts || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const startDM = async () => {
    if (!profile || !userId) return;
    try {
      const res = await fetch("/api/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: userId }),
      });
      const data = await res.json();
      if (data.conversation) {
        useStore.getState().setSelectedDM(data.conversation);
        useStore.getState().setTab("dms");
      }
    } catch { toast.error("Erro ao iniciar conversa"); }
  };

  if (loading) return <div className="space-y-4">{[1,2].map(i=><div key={i} className="h-24 rounded-xl bg-muted/50 animate-pulse"/>)}</div>;
  if (!user) return <p className="py-8 text-center text-sm text-muted-foreground">Usuário não encontrado</p>;

  const isSelf = profile?.id === userId;
  const avatarUrl = user.avatar_url;

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={user.display_name} />
              ) : null}
              <AvatarFallback className={`${getAvatarColor(user.id)} text-lg text-white`}>
                {getInitials(user.display_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-lg font-bold">{user.display_name}</h2>
              <p className="text-sm text-muted-foreground">@{user.username}</p>
              {user.neighborhood && (
                <Badge variant="secondary" className="mt-1.5 gap-1">
                  <MapPin className="h-3 w-3" /> {user.neighborhood}
                </Badge>
              )}
            </div>
          </div>

          {user.bio ? (
            <p className="mt-4 text-sm">{user.bio}</p>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground italic">Sem bio</p>
          )}

          <div className="mt-4 flex gap-6">
            <div className="text-center">
              <p className="text-lg font-bold">{user._count?.posts || posts.length}</p>
              <p className="text-xs text-muted-foreground">Posts</p>
            </div>
          </div>

          {!isSelf && (
            <Button onClick={startDM} className="mt-4 w-full gap-2">
              <MessageCircle className="h-4 w-4" /> Conversar
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Posts do usuário */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Posts</h3>
        {posts.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nenhum post ainda</p>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <div key={post.id} className="rounded-xl border bg-card p-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
                <div className="mt-2 flex items-center gap-3 text-muted-foreground">
                  <span className="flex items-center gap-1 text-xs">
                    <Heart className="h-3.5 w-3.5" /> {post.reactions?.length || 0}
                  </span>
                  <span className="flex items-center gap-1 text-xs">
                    <MessageCircle className="h-3.5 w-3.5" /> {post.comment_count || 0}
                  </span>
                  <span className="text-xs">{timeAgo(post.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
