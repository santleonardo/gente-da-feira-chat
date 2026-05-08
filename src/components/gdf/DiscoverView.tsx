"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Users, MessageCircle } from "lucide-react";
import { getInitials, getAvatarColor } from "@/lib/constants";
import { toast } from "sonner";
import type { UserSearchResult, Room } from "@/lib/types";

export function DiscoverView() {
  const { profile } = useStore();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const [userRes, roomRes] = await Promise.all([
        fetch(
          `/api/users?q=${encodeURIComponent(query)}&userId=${profile?.id}`
        ),
        fetch("/api/rooms"),
      ]);
      const userData = await userRes.json();
      const roomData = await roomRes.json();
      setUsers(userData.users || []);
      setRooms(roomData.rooms || []);
      setSearched(true);
    } catch (err) {
      console.error("[DiscoverView] handleSearch", err);
      toast.error("Erro ao buscar");
    } finally {
      setSearching(false);
    }
  };

  const startDM = async (otherUser: UserSearchResult) => {
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
    } catch {
      toast.error("Erro ao iniciar conversa");
    }
  };

  // Carregar salas populares ao montar
  useState(() => {
    const fetchRooms = async () => {
      try {
        const res = await fetch("/api/rooms");
        const data = await res.json();
        setRooms(data.rooms || []);
      } catch (err) {
        console.error("[DiscoverView] fetchRooms", err);
      }
    };
    fetchRooms();
  });

  const popularRooms = rooms
    .filter((r) => r.type === "official")
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Search */}
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
        <Button onClick={handleSearch} disabled={!query.trim() || searching}>
          {searching ? "Buscando..." : "Buscar"}
        </Button>
      </div>

      {/* Search Results */}
      {searched && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
            Resultados para &quot;{query}&quot;
          </h3>
          {users.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum usuário encontrado
            </p>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 rounded-xl border bg-card p-3"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback
                      className={`${getAvatarColor(u.id)} text-xs text-white`}
                    >
                      {getInitials(u.display_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold">
                      {u.display_name}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      @{u.username}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startDM(u)}
                    className="gap-1"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> Conversar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Popular Rooms */}
      {!searched && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Salas populares
          </h3>
          <div className="space-y-2">
            {popularRooms.map((room) => {
              const memberCount =
                room._count?.members ?? room.member_count ?? 0;
              return (
                <button
                  key={room.id}
                  onClick={() =>
                    useStore.getState().setSelectedRoom(room)
                  }
                  className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-accent"
                >
                  <span className="text-xl">{room.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">
                      {room.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {memberCount}
                  </div>
                </button>
              );
            })}
            {popularRooms.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nenhuma sala popular disponível
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
