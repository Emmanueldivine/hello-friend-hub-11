import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";

const TABLES = [
  "profiles",
  "orders",
  "assignments",
  "wallets",
  "transactions",
  "chats",
  "chat_messages",
] as const;

/** Keeps every admin page in sync with live activity from the student portal. */
export function useAdminRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase.channel("admin-live");
    for (const table of TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        queryClient.invalidateQueries();
      });
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
