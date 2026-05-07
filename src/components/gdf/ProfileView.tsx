"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { useStore, Profile } from "@/lib/store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, LogOut, Edit3 } from "lucide-react";
import { getInitials, getAvatarColor, BAIRROS } from "@/lib/constants";
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
  const [loading, setLoading] = useState(true);

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
        body: JSON.stringify({ name, bio, neighborhood }),
      });
      const data = await res.json();
      if (data.user) {
        updateProfile(data.user);
        setEditing(false);
        toast.success("Perfil atualizado!");
      }
    } catch { toast.error("Erro ao salvar"); }
  };

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      logout();
    } catch {
      toast.error("Erro ao sair");
    }
  };

  if (loading) return <div className="space-y-4">{[1,2].map(i=><div key={i} className="h-24 rounded-xl bg-muted/50 animate-pulse"/>)}</div>;

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className={`${getAvatarColor(profile?.id || "")} text-lg text-white`}>
                  {getInitials(profile?.display_name || "?")}
                </AvatarFallback>
              </Avatar>
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
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Bio</Label>
                <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
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

          {/* Stats */}
          <div className="mt-6 flex gap-6">
            <div className="text-center">
              <p className="text-lg font-bold">{postCount}</p>
              <p className="text-xs text-muted-foreground">Posts</p>
            </div>
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

      {/* Logout */}
      <Button variant="destructive" onClick={handleLogout} className="w-full gap-2">
        <LogOut className="h-4 w-4" /> Sair da conta
      </Button>
    </div>
  );
}
