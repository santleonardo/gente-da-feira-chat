"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface UseRealtimeMessagesOptions {
  table: string;
  filter?: string;
  onInsert?: (payload: any) => void;
  onDelete?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  enabled?: boolean;
}

export function useRealtimeMessages({
  table, filter, onInsert, onDelete, onUpdate, enabled = true,
}: UseRealtimeMessagesOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    let channelName = `realtime:${table}`;
    if (filter) channelName += `:${filter}`;

    const channel = supabase.channel(channelName).on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table, filter: filter || undefined },
      (payload) => { onInsert?.(payload.new); }
    );

    if (onDelete) {
      channel.on("postgres_changes",
        { event: "DELETE", schema: "public", table, filter: filter || undefined },
        (payload) => { onDelete?.(payload.old); }
      );
    }
    if (onUpdate) {
      channel.on("postgres_changes",
        { event: "UPDATE", schema: "public", table, filter: filter || undefined },
        (payload) => { onUpdate?.(payload.new); }
      );
    }

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, filter, enabled, onInsert, onDelete, onUpdate]);

  return channelRef;
}
