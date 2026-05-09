"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef, useCallback } from "react";
import { useStore } from "@/lib/store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Send, ArrowLeft, Users, Plus, LogOut, UserPlus, UserCheck, ChevronDown, ChevronUp, X,
} from "lucide-react";
import { getInitials, getAvatarColor, timeAgo } from "@/lib/constants";
import { useRealtimeMessages } from "@/hooks/use-realtime";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ROOM_ICONS = [
  "💬", "🏠", "🎮", "⚽", "🎵", "📸", "🎬", "📚",
  "🍕", "💡", "🔧", "🎯", "🌟", "🚀", "❤️", "🔥",
  "🎨", "💻", "🐶", "🌈", "☕", "🛒", "📣", "🤝",
];

export function RoomsView() {
  const { profile, selectedRoom, setSelectedRoom } = useStore();
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

  if (selectedRoom) return <RoomChat room={selectedRoom} onBack={() => setSelectedRoom(null)} onRefreshRooms={fetchRooms} />;

  if (loading) return <div className="space-y-3">{[1,2,3,4].map(i=><div key={i} className="h-16 rounded-xl bg-muted/50 animate-pulse"/>)}</div>;

  const official = rooms.filter((r) => r.type === "official");
  const community = rooms.filter((r) => r.type === "community");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Salas</h2>
        <Button variant="outline" size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Criar sala
        </Button>
      </div>

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
          {community.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nenhuma comunidade ainda. Crie a primeira!
            </p>
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
        {memberCount}
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
    if (!name.trim()) { toast.error("Nome da sala é obrigatório"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), icon }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      toast.success(`Sala "${data.room.name}" criada!`);
      onCreated(data.room);
      onOpenChange(false);
      setName(""); setDescription(""); setIcon("💬");
    } catch { toast.error("Erro ao criar sala"); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Criar nova sala</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Ícone da sala</Label>
            <div className="flex flex-wrap gap-1.5">
              {ROOM_ICONS.map((emoji) => (
                <button key={emoji} onClick={() => setIcon(emoji)}
                  className={`h-9 w-9 rounded-lg text-lg flex items-center justify-center transition-colors ${icon === emoji ? "bg-primary text-primary-foreground ring-2 ring-primary" : "bg-muted hover:bg-accent"}`}>
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Nome da sala</Label>
            <Input placeholder="Ex: Bate-papo do Centro" value={name} onChange={(e) => setName(e.target.value.slice(0, 50))} maxLength={50} />
            <span className="text-xs text-muted-foreground">{name.length}/50</span>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Input placeholder="Do que essa sala é sobre?" value={description} onChange={(e) => setDescription(e.target.value.slice(0, 200))} maxLength={200} />
            <span className="text-xs text-muted-foreground">{description.length}/200</span>
          </div>
          <Button onClick={handleCreate} disabled={loading || !name.trim()} className="w-full">
            {loading ? "Criando..." : "Criar sala"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RoomChat({ room, onBack, onRefreshRooms }: { room: any; onBack: () => void; onRefreshRooms: () => void }) {
  const { profile } = useStore();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Buscar membros AO ENTRAR NA SALA (não só ao abrir painel)
  const fetchMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const supabase = createClient();
      const { data: rawMembers, error } = await supabase
        .from("room_members")
        .select("id, user_id, created_at")
        .eq("room_id", room.id);

      if (!error && rawMembers && rawMembers.length > 0) {
        const userIds = rawMembers.map((m: any) => m.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar, neighborhood")
          .in("id", userIds);

        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
        setMembers(rawMembers.map((m: any) => ({
          id: m.id, user_id: m.user_id, joined_at: m.created_at,
          profile: profileMap.get(m.user_id) || null,
        })));
      } else if (error) {
        // Fallback: tentar via API
        const res = await fetch(`/api/rooms/${room.id}/members`);
        const data = await res.json();
        if (data.members) setMembers(data.members);
      }
    } catch { /* silent */ }
    setMembersLoading(false);
  }, [room.id]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  // Buscar mensagens
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${room.id}/messages?limit=50`);
      const data = await res.json();
      if (!data.error) setMessages(data.messages || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [room.id]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Verificar se é membro
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

  // Realtime: novas mensagens
  const handleNewMessage = useCallback((payload: any) => {
    const fetchSender = async () => {
      const supabase = createClient();
      const { data: sender } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar")
        .eq("id", payload.sender_id)
        .single();
      const newMsg = { ...payload, sender: sender || { id: payload.sender_id, display_name: "Usuário", username: "" } };
      setMessages((prev) => prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]);
    };
    fetchSender();
  }, []);

  useRealtimeMessages({
    table: "messages",
    filter: `room_id=eq.${room.id}`,
    onInsert: handleNewMessage,
    enabled: !!profile && isMember,
  });

  // Realtime: membros entram/saem
  const handleMemberJoin = useCallback((payload: any) => {
    const fetchProf = async () => {
      const supabase = createClient();
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar, neighborhood")
        .eq("id", payload.user_id)
        .single();
      if (prof) {
        setMembers((prev) => prev.some((m) => m.user_id === payload.user_id) ? prev : [...prev, { id: payload.id, user_id: payload.user_id, joined_at: payload.created_at, profile: prof }]);
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
      if (data.error) { toast.error(data.error); return; }
      if (data.joined) { setIsMember(true); toast.success("Você entrou na sala!"); fetchMembers(); onRefreshRooms(); }
    } catch { toast.error("Erro ao entrar na sala"); }
  };

  const handleLeave = async () => {
    try {
      const res = await fetch(`/api/rooms/${room.id}/leave`, { method: "POST" });
      const data = await res.json();
      if (data.left) { setIsMember(false); toast.success("Você saiu da sala"); onRefreshRooms(); onBack(); }
    } catch { toast.error("Erro ao sair da sala"); }
  };

  useEffect(() => { if (showMembers) fetchMembers(); }, [showMembers, fetchMembers]);

  const sendMessage = async () => {
    if (!input.trim() || !profile || !isMember) return;
    const text = input.trim();
    setInput("");
    try {
      const res = await fetch(`/api/rooms/${room.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      if (data.message) setMessages((prev) => prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]);
    } catch { toast.error("Erro ao enviar mensagem"); }
  };

  const memberCount = members.length || room.memberCount || room.member_count || 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b pb-3 mb-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-xl">{room.icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold">{room.name}</h3>
          <p className="text-xs text-muted-foreground">
            {room.description || `${memberCount} membro${memberCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowMembers(!showMembers)} className="gap-1 text-xs">
          <Users className="h-4 w-4" />
          <span>{memberCount}</span>
          {showMembers ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {showMembers && (
        <div className="mb-3 rounded-xl border bg-card p-3 max-h-64 overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Membros ({members.length})</h4>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowMembers(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          {membersLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-8 rounded bg-muted/50 animate-pulse" />)}</div>
          ) : members.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">Nenhum membro ainda</p>
          ) : (
            <div className="space-y-1">
              {members.map((m: any) => {
                const mp = m.profile;
                if (!mp) return (
                  <div key={m.id || m.user_id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors">
                    <Avatar className="h-7 w-7"><AvatarFallback className="bg-muted text-[10px]">?</AvatarFallback></Avatar>
                    <span className="text-xs text-muted-foreground">Usuário</span>
                    {m.user_id === profile?.id && <Badge variant="secondary" className="text-[9px] px-1 py-0">Você</Badge>}
                  </div>
                );
                return (
                  <div key={m.id || m.user_id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors">
                    <Avatar className="h-7 w-7"><AvatarFallback className={`${getAvatarColor(mp.id)} text-[10px] text-white`}>{getInitials(mp.display_name)}</AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium">{mp.display_name}</span>
                      {mp.neighborhood && <span className="text-[10px] text-muted-foreground ml-1">· {mp.neighborhood}</span>}
                    </div>
                    {m.user_id === profile?.id && <Badge variant="secondary" className="text-[9px] px-1 py-0">Você</Badge>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!isMember && (
        <div className="mb-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 text-center">
          <Users className="h-8 w-8 mx-auto mb-2 text-primary/60" />
          <p className="text-sm font-medium mb-1">Você não está nesta sala</p>
          <p className="text-xs text-muted-foreground mb-3">Entre para ver e enviar mensagens</p>
          <Button onClick={handleJoin} size="sm" className="gap-1.5"><UserPlus className="h-4 w-4" /> Entrar na sala</Button>
        </div>
      )}

      {isMember && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pb-2" style={{ maxHeight: "calc(100vh - 380px)" }}>
          {loading && <div className="text-center text-xs text-muted-foreground py-4">Carregando...</div>}
          {messages.map((msg) => {
            const isMine = msg.sender_id === profile?.id;
            return (
              <div key={msg.id} className={`flex gap-2 ${isMine ? "flex-row-reverse" : ""}`}>
                {!isMine && <Avatar className="h-7 w-7 shrink-0"><AvatarFallback className={`${getAvatarColor(msg.sender.id)} text-[10px] text-white`}>{getInitials(msg.sender.display_name)}</AvatarFallback></Avatar>}
                <div className={`max-w-[75%] ${isMine ? "text-right" : ""}`}>
                  {!isMine && <span className="text-[10px] font-medium text-muted-foreground">{msg.sender.display_name}</span>}
                  <div className={`rounded-2xl px-3.5 py-2 text-sm inline-block ${isMine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{msg.content}</div>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(msg.created_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="border-t pt-3 mt-2 space-y-2">
        {isMember ? (
          <>
            <div className="flex items-center gap-2">
              <Input placeholder="Mensagem..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()} className="flex-1" />
              <Button size="icon" onClick={sendMessage} disabled={!input.trim()} className="rounded-full"><Send className="h-4 w-4" /></Button>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLeave} className="w-full text-muted-foreground hover:text-destructive gap-1.5 text-xs"><LogOut className="h-3.5 w-3.5" /> Sair da sala</Button>
          </>
        ) : (
          <Button onClick={handleJoin} className="w-full gap-1.5"><UserCheck className="h-4 w-4" /> Entrar na sala</Button>
        )}
      </div>
    </div>
  );
}
