"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef, useCallback } from "react";
import { useStore } from "@/lib/store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Send, ArrowLeft, Users } from "lucide-react";
import { getInitials, getAvatarColor, timeAgo } from "@/lib/constants";
import { toast } from "sonner";

export function RoomsView() {
  const { profile, selectedRoom, setSelectedRoom } = useStore();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch("/api/rooms");
      const data = await res.json();
      setRooms(data.rooms || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  if (selectedRoom) return <RoomChat room={selectedRoom} onBack={() => setSelectedRoom(null)} />;

  if (loading) return <div className="space-y-3">{[1,2,3,4].map(i=><div key={i} className="h-16 rounded-xl bg-muted/50 animate-pulse"/>)}</div>;

  const official = rooms.filter((r) => r.type === "official");
  const community = rooms.filter((r) => r.type === "community");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Oficiais</h3>
        <div className="space-y-2">
          {official.map((room) => (
            <RoomCard key={room.id} room={room} onClick={() => setSelectedRoom(room)} />
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Comunidades</h3>
        <div className="space-y-2">
          {community.map((room) => (
            <RoomCard key={room.id} room={room} onClick={() => setSelectedRoom(room)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RoomCard({ room, onClick }: { room: any; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border bg-card p-3.5 text-left transition-colors hover:bg-accent"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-xl">
        {room.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{room.name}</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {room.type === "official" ? "Oficial" : "Comunidade"}
          </Badge>
        </div>
        {room.description && (
          <p className="text-xs text-muted-foreground truncate">{room.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        {room.memberCount || 0}
      </div>
    </button>
  );
}

function RoomChat({ room, onBack }: { room: any; onBack: () => void }) {
  const { profile } = useStore();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${room.id}/messages?limit=50`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [room.id]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 100);
  }, [messages, loading]);

  // Auto-join ao entrar
  useEffect(() => {
    if (profile) {
      fetch(`/api/rooms/${room.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile.id }),
      });
    }
  }, [profile, room.id]);

  const sendMessage = async () => {
    if (!input.trim() || !profile) return;
    const text = input.trim();
    setInput("");
    try {
      const res = await fetch(`/api/rooms/${room.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (data.message) setMessages((prev) => [...prev, data.message]);
    } catch { toast.error("Erro ao enviar mensagem"); }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b pb-3 mb-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-xl">{room.icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold">{room.name}</h3>
          <p className="text-xs text-muted-foreground">
            {room.description || `${room.memberCount || 0} membros`}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pb-2" style={{ maxHeight: "calc(100vh - 300px)" }}>
        {loading && <div className="text-center text-xs text-muted-foreground py-4">Carregando...</div>}
        {messages.map((msg) => {
          const isMine = msg.sender_id === profile?.id;
          return (
            <div key={msg.id} className={`flex gap-2 ${isMine ? "flex-row-reverse" : ""}`}>
              {!isMine && (
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className={`${getAvatarColor(msg.sender.id)} text-[10px] text-white`}>
                    {getInitials(msg.sender.display_name)}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className={`max-w-[75%] ${isMine ? "text-right" : ""}`}>
                {!isMine && <span className="text-[10px] font-medium text-muted-foreground">{msg.sender.display_name}</span>}
                <div className={`rounded-2xl px-3.5 py-2 text-sm inline-block ${
                  isMine ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}>
                  {msg.content}
                </div>
                <span className="text-[10px] text-muted-foreground">{timeAgo(msg.created_at)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 border-t pt-3 mt-2">
        <Input
          placeholder="Mensagem..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          className="flex-1"
        />
        <Button size="icon" onClick={sendMessage} disabled={!input.trim()} className="rounded-full">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
