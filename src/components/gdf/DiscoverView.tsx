"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Users, MessageCircle } from "lucide-react";
import { UserAvatar } from "./UserAvatar";
import { toast } from "sonner";

export function DiscoverView({ openUserProfile }: { openUserProfile?: (userId: string) => void }) {
  const { profile } = useStore();
  const navigateToProfile = (uid: string) => {
    if (openUserProfile) {
      openUserProfile(uid);
    } else {
      window.dispatchEvent(new CustomEvent("openUserProfile", { detail: { userId: uid } }));
    }
  };
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);

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
                  <button onClick={() => navigateToProfile(u.id)} className="shrink-0">
                    <UserAvatar user={{ id: u.id, display_name: u.display_name, avatar_url: u.avatar_url }} className="h-10 w-10 hover:opacity-80 transition-opacity" />
                  </button>
                  <div className="flex-1 min-w-0" onClick={() => navigateToProfile(u.id)} style={{ cursor: "pointer" }}>
                    <span className="text-sm font-semibold">{u.display_name}</span>
                    <p className="text-xs text-muted-foreground">@{u.username}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => startDM(u)} className="gap-1">
                    <MessageCircle className="h-3.5 w-3.5" /> Conversar
                  </Button>
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
