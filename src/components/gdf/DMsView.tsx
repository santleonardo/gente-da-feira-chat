"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef, useCallback } from "react";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, ArrowLeft, UserPlus, Search, MessageSquare } from "lucide-react";
import { timeAgo } from "@/lib/constants";
import { UserAvatar } from "./UserAvatar";
import { useRealtimeMessages } from "@/hooks/use-realtime";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DMsView() {
  const { profile, selectedDM, setSelectedDM } = useStore();
  const [conversations, setConversations] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [searchUsers, setSearchUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDMs = useCallback(async () => {
    try {
      const res = await fetch("/api/dm");
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
      setConversations(data.conversations || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDMs(); }, [fetchDMs]);

  const handleSearch = async (q: string) => {
    if (q.length < 2) { setSearchUsers([]); return; }
    try {
      const res = await fetch(`/api/users?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchUsers(data.users || []);
    } catch { /* silent */ }
  };

  const startConversation = async (otherUser: any) => {
    if (!profile) return;
    try {
      const res = await fetch("/api/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: otherUser.id }),
      });
      const data = await res.json();
      if (data.conversation) {
        setSelectedDM(data.conversation);
        setShowNew(false);
        fetchDMs();
      }
    } catch { toast.error("Erro ao criar conversa"); }
  };

  if (selectedDM) return <DMChat conversation={selectedDM} onBack={() => { setSelectedDM(null); fetchDMs(); }} />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Mensagens</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{conversations.length} conversa{conversations.length !== 1 ? "s" : ""}</p>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)} className="gap-1.5 rounded-full px-4 shadow-sm">
          <UserPlus className="h-4 w-4" /> Nova
        </Button>
      </div>

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-2xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && conversations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
            <MessageSquare className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Nenhuma conversa ainda</p>
          <p className="text-xs text-muted-foreground mt-0.5">Comece uma conversa clicando em &quot;Nova&quot;</p>
        </div>
      )}

      <div className="space-y-1">
        {conversations.map((conv) => {
          const other = conv.initiator_id === profile?.id ? conv.receiver : conv.initiator;
          return (
            <button
              key={conv.id}
              onClick={() => setSelectedDM(conv)}
              className="group flex w-full items-center gap-3.5 rounded-2xl bg-card px-4 py-3.5 text-left transition-all duration-200 hover:bg-accent hover:shadow-sm active:scale-[0.98] border border-transparent hover:border-border/50"
            >
              <div className="relative shrink-0">
                <UserAvatar user={{ id: other.id, display_name: other.display_name, avatar_url: other.avatar_url }} className="h-12 w-12" />
                <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold truncate">{other.display_name}</span>
                  <span className="text-[10px] text-muted-foreground/60 shrink-0">{timeAgo(conv.updated_at)}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">@{other.username}</p>
              </div>
            </button>
          );
        })}
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg">Nova conversa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou @usuario..."
                onChange={(e) => handleSearch(e.target.value)}
                autoFocus
                className="pl-9 h-11 rounded-xl"
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-0.5 custom-scrollbar">
              {searchUsers.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">Digite para buscar pessoas</p>
              )}
              {searchUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => startConversation(u)}
                  className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-all duration-150 hover:bg-accent active:scale-[0.98]"
                >
                  <UserAvatar user={{ id: u.id, display_name: u.display_name, avatar_url: u.avatar_url }} className="h-10 w-10" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{u.display_name}</div>
                    <div className="text-xs text-muted-foreground">@{u.username}</div>
                  </div>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DMChat — Redesenhado com visual de mensageiro moderno
// ═══════════════════════════════════════════════════════════
function DMChat({ conversation, onBack }: { conversation: any; onBack: () => void }) {
  const { profile } = useStore();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const other = conversation.initiator_id === profile?.id ? conversation.receiver : conversation.initiator;

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/dm/${conversation.id}/messages`);
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
      setMessages(data.messages || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [conversation.id]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const handleNewMessage = useCallback((payload: any) => {
    const fetchSender = async () => {
      const supabase = createClient();
      const { data: sender } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .eq("id", payload.sender_id)
        .single();

      const newMsg = { ...payload, sender: sender || { id: payload.sender_id, display_name: "Usuário", username: "" } };
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    };
    fetchSender();
  }, []);

  useRealtimeMessages({
    table: "messages",
    filter: `dm_id=eq.${conversation.id}`,
    onInsert: handleNewMessage,
    enabled: !!profile,
  });

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 100);
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim() || !profile) return;
    const text = input.trim();
    setInput("");
    try {
      const res = await fetch(`/api/dm/${conversation.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
      if (data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
    } catch { toast.error("Erro ao enviar"); }
  };

  const groupedMessages = messages.map((msg, idx) => {
    const prev = idx > 0 ? messages[idx - 1] : null;
    const isGrouped = prev && prev.sender_id === msg.sender_id;
    return { ...msg, isGrouped };
  });

  return (
    <div className="flex h-full flex-col -mx-4 -mt-4 md:-mx-0 md:-mt-0">
      <div className="flex items-center gap-3 border-b px-4 py-3 bg-card/80 backdrop-blur-md sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 rounded-full hover:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="relative">
          <UserAvatar user={{ id: other.id, display_name: other.display_name, avatar_url: other.avatar_url }} className="h-10 w-10" />
          <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-emerald-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold truncate">{other.display_name}</h3>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Online</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1" style={{ maxHeight: "calc(100vh - 280px)" }}>
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-xs text-muted-foreground">Carregando...</span>
            </div>
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
              <MessageSquare className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Inicie a conversa</p>
            <p className="text-xs text-muted-foreground mt-0.5">Diga olá para {other.display_name}!</p>
          </div>
        )}
        {groupedMessages.map((msg) => {
          const isMine = msg.sender_id === profile?.id;

          return (
            <div key={msg.id} className={`flex ${msg.isGrouped ? "" : "mt-2"} ${isMine ? "justify-end" : "justify-start"}`}>
              <div className="flex items-end gap-1.5 max-w-[80%]">
                {isMine && (
                  <span className="text-[9px] text-muted-foreground/50 mb-1 shrink-0">{timeAgo(msg.created_at)}</span>
                )}
                <div className={`px-3.5 py-2 text-sm leading-relaxed inline-block break-words ${
                  isMine
                    ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md"
                    : "bg-muted rounded-2xl rounded-bl-md"
                }`}>
                  {msg.content}
                </div>
                {!isMine && (
                  <span className="text-[9px] text-muted-foreground/50 mb-1 shrink-0">{timeAgo(msg.created_at)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t px-4 py-3 bg-card/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Input
              placeholder="Escreva uma mensagem..."
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 2000))}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              className="h-11 rounded-full pl-4 pr-4 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/30"
            />
          </div>
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim()}
            className="h-11 w-11 rounded-full shrink-0 shadow-sm transition-all hover:shadow-md disabled:shadow-none"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
