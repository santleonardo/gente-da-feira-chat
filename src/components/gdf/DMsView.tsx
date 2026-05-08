"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useStore } from "@/lib/store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, ArrowLeft, UserPlus } from "lucide-react";
import {
  getInitials,
  getAvatarColor,
  timeAgo,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Conversation, Message, UserSearchResult } from "@/lib/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

export function DMsView() {
  const { profile, selectedDM, setSelectedDM } = useStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [searchUsers, setSearchUsers] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDMs = useCallback(async () => {
    if (!profile) return;
    try {
      // O servidor obtém o userId da sessão autenticada (C1 fix)
      const res = await fetch("/api/dm");
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erro ao buscar conversas");
        return;
      }
      setConversations(data.conversations || []);
    } catch (err) {
      console.error("[DMsView] fetchDMs", err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchDMs();
  }, [fetchDMs]);

  const handleSearch = async (q: string) => {
    if (q.length < 2) {
      setSearchUsers([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/users?q=${encodeURIComponent(q)}&userId=${profile?.id}`
      );
      const data = await res.json();
      setSearchUsers(data.users || []);
    } catch (err) {
      console.error("[DMsView] handleSearch", err);
    }
  };

  const startConversation = async (otherUser: UserSearchResult) => {
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
    } catch {
      toast.error("Erro ao criar conversa");
    }
  };

  if (selectedDM)
    return (
      <DMChat
        conversation={selectedDM}
        onBack={() => {
          setSelectedDM(null);
          fetchDMs();
        }}
      />
    );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Mensagens</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowNew(true)}
          className="gap-1.5"
        >
          <UserPlus className="h-4 w-4" /> Nova
        </Button>
      </div>

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 rounded-xl bg-muted/50 animate-pulse"
            />
          ))}
        </div>
      )}

      {!loading && conversations.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Nenhuma conversa ainda. Clique em &quot;Nova&quot; para começar!
        </p>
      )}

      {conversations.map((conv) => {
        const other =
          conv.initiator_id === profile?.id
            ? conv.receiver
            : conv.initiator;
        return (
          <button
            key={conv.id}
            onClick={() => setSelectedDM(conv)}
            className="flex w-full items-center gap-3 rounded-xl border bg-card p-3.5 text-left transition-colors hover:bg-accent mb-2"
          >
            <Avatar className="h-11 w-11">
              <AvatarFallback
                className={`${getAvatarColor(other.id)} text-sm text-white`}
              >
                {getInitials(other.display_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold">
                {other.display_name}
              </span>
              <p className="text-xs text-muted-foreground truncate">
                @{other.username}
              </p>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {timeAgo(conv.updated_at)}
            </span>
          </button>
        );
      })}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova conversa</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Buscar por nome ou @usuario..."
            onChange={(e) => handleSearch(e.target.value)}
            autoFocus
          />
          <div className="max-h-64 overflow-y-auto space-y-1">
            {searchUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => startConversation(u)}
                className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-accent"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback
                    className={`${getAvatarColor(u.id)} text-xs text-white`}
                  >
                    {getInitials(u.display_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-sm font-medium">{u.display_name}</div>
                  <div className="text-xs text-muted-foreground">
                    @{u.username}
                  </div>
                </div>
              </button>
            ))}
            {searchUsers.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Nenhum usuário encontrado
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DMChat({
  conversation,
  onBack,
}: {
  conversation: Conversation;
  onBack: () => void;
}) {
  const { profile } = useStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const other =
    conversation.initiator_id === profile?.id
      ? conversation.receiver
      : conversation.initiator;

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/dm/${conversation.id}/messages`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err) {
      console.error("[DMChat] fetchMessages", err);
    } finally {
      setLoading(false);
    }
  }, [conversation.id]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Supabase Realtime: escutar novas mensagens DM
  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel;

    const setupRealtime = () => {
      channel = supabase
        .channel(`dm-${conversation.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `dm_id=eq.${conversation.id}`,
          },
          async (payload) => {
            const { data: newMsg } = await supabase
              .from("messages")
              .select(
                `*, sender:profiles(id, display_name, username, avatar)`
              )
              .eq("id", payload.new.id)
              .single();

            if (newMsg && !newMsg.is_deleted) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [...prev, newMsg as Message];
              });
            }
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [conversation.id]);

  useEffect(() => {
    setTimeout(
      () =>
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
        }),
      100
    );
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
      if (res.ok && data.message) {
        setMessages((prev) => [...prev, data.message as Message]);
      } else {
        toast.error(data.error || "Erro ao enviar");
        setInput(text);
      }
    } catch {
      toast.error("Erro ao enviar");
      setInput(text);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b pb-3 mb-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-9 w-9">
          <AvatarFallback
            className={`${getAvatarColor(other.id)} text-xs text-white`}
          >
            {getInitials(other.display_name)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="text-sm font-bold">{other.display_name}</h3>
          <p className="text-xs text-muted-foreground">@{other.username}</p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 pb-2 custom-scrollbar"
        style={{ maxHeight: "calc(100vh - 300px)" }}
      >
        {loading && (
          <div className="text-center text-xs text-muted-foreground py-4">
            Carregando...
          </div>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_id === profile?.id;
          return (
            <div
              key={msg.id}
              className={`flex gap-2 ${isMine ? "flex-row-reverse" : ""}`}
            >
              <div className={`max-w-[75%] ${isMine ? "text-right" : ""}`}>
                <div
                  className={`rounded-2xl px-3.5 py-2 text-sm inline-block ${
                    isMine
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-muted-foreground ml-1">
                  {timeAgo(msg.created_at)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 border-t pt-3 mt-2">
        <Input
          placeholder="Mensagem..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && !e.shiftKey && sendMessage()
          }
          className="flex-1"
        />
        <Button
          size="icon"
          onClick={sendMessage}
          disabled={!input.trim()}
          className="rounded-full"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
