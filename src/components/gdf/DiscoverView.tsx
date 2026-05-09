"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Users, MessageCircle, User } from "lucide-react";
import { getInitials, getAvatarColor } from "@/lib/constants";
import { toast } from "sonner";
import { PublicProfileView } from "./PublicProfileView";

export function DiscoverView() {
  const { profile } = useStore();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    try {
      const [userRes, roomRes] = await Promise.all([
        fetch(`/api/users?q=${encodeURIComponent(query)}`),
        fetch("/api/rooms"),
      ]);
      const userData = await userRes.json();
      const roomData = await roomRes.json();
      setUsers(userData.users || []);
      setRooms(roomData.rooms || []);
      setSearched(true);
    } catch { /* silent */ }
  };

  const startDM = async (otherUser: any) => {
    if (!profile) return;
    try {
      const res = await fetch("/api/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: otherUser.id }),
      });
      const data = await res.json();
      if (data.conversation) {
        useStore.getState().setSelectedDM(data.conversation);
        useStore.getState().setTab("dms");
      }
    } catch { toast.error("Erro"); }
  };

  if (viewingUserId) {
    return (
      <PublicProfileView
        userId={viewingUserId}
        onBack={() => setViewingUserId(null)}
      />
    );
  }

  const popularRooms = rooms.filter((r) => r.type === "official").slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar pessoas..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} disabled={!query.trim()}>
          Buscar
        </Button>
      </div>

      {searched && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
            Resultados para &quot;{query}&quot;
          </h3>
          {users.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nenhum usuário encontrado</p>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                  <button onClick={() => setViewingUserId(u.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <Avatar className="h-10 w-10">
                      {u.avatar_url ? <AvatarImage src={u.avatar_url} alt={u.display_name} /> : null}
                      <AvatarFallback className={`${getAvatarColor(u.id)} text-xs text-white`}>
                        {getInitials(u.display_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold">{u.display_name}</span>
                      <p className="text-xs text-muted-foreground">@{u.username}</p>
                    </div>
                    <User className="h-4 w-4 text-muted-foreground" />
                  </button>
                  {u.id !== profile?.id && (
                    <Button variant="outline" size="sm" onClick={() => startDM(u)} className="gap-1 shrink-0">
                      <MessageCircle className="h-3.5 w-3.5" /> Conversar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!searched && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Salas populares
          </h3>
          <div className="space-y-2">
            {popularRooms.map((room) => (
              <button
                key={room.id}
                onClick={() => useStore.getState().setSelectedRoom(room)}
                className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-accent"
              >
                <span className="text-xl">{room.icon}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{room.name}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {room.memberCount || 0}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
