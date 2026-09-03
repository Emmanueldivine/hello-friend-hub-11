import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Guard, PageHead, Pill, Stat } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/chats")({
  component: () => (
    <Guard area="chats">
      <Chats />
    </Guard>
  ),
});

function Chats() {
  const qc = useQueryClient();
  const { session } = useAdminAuth();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [body, setBody] = useState("");

  const { data: chats = [] } = useQuery({
    queryKey: ["admin-chats"],
    queryFn: async () => {
      const [{ data: rows }, { data: profiles }, { data: vendors }] = await Promise.all([
        supabase.from("chats").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name"),
        supabase.from("vendors").select("id, business_name"),
      ]);
      return (rows ?? []).map((c) => ({
        ...c,
        student: (profiles ?? []).find((p) => p.id === c.student_id),
        vendor: (vendors ?? []).find((v) => v.id === c.vendor_id),
      }));
    },
  });

  const currentId = activeId ?? chats[0]?.id ?? null;
  const current = chats.find((c) => c.id === currentId);

  const { data: messages = [] } = useQuery({
    queryKey: ["admin-chat-messages", currentId],
    enabled: !!currentId,
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("chat_id", currentId as string)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      if (!currentId || !body.trim() || !session) return;
      const { error } = await supabase.from("chat_messages").insert({
        chat_id: currentId,
        sender_id: session.userId,
        sender_name: `${session.fullName} (Admin)`,
        body: body.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["admin-chat-messages", currentId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setChatStatus = useMutation({
    mutationFn: async (status: string) => {
      if (!currentId) return;
      const { error } = await supabase.from("chats").update({ status }).eq("id", currentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conversation updated");
      qc.invalidateQueries({ queryKey: ["admin-chats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disputes = chats.filter((c) => c.is_dispute);

  return (
    <>
      <PageHead title="Chat Management" subtitle="Monitor conversations and resolve disputes" />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Conversations" value={chats.length} />
        <Stat label="Open disputes" value={disputes.filter((c) => c.status === "open").length} />
        <Stat label="Resolved" value={chats.filter((c) => c.status === "resolved").length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="max-h-[560px] overflow-y-auto p-0">
          {chats.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No conversations yet.</p>
          ) : (
            chats.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`block w-full border-b px-4 py-3 text-left last:border-0 transition-colors ${
                  c.id === currentId ? "bg-muted" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{c.subject}</span>
                  {c.is_dispute ? <Pill tone="bad">dispute</Pill> : null}
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {c.student?.full_name ?? "Student"} ↔ {c.vendor?.business_name ?? "Vendor"}
                </p>
              </button>
            ))
          )}
        </Card>

        <Card className="flex min-h-[420px] flex-col p-0">
          {current ? (
            <>
              <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
                <div className="mr-auto">
                  <p className="font-bold">{current.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {current.student?.full_name ?? "Student"} ↔{" "}
                    {current.vendor?.business_name ?? "Vendor"}
                  </p>
                </div>
                <Pill tone={current.status === "resolved" ? "good" : "warn"}>{current.status}</Pill>
                <Button size="sm" variant="outline" onClick={() => setChatStatus.mutate("resolved")}>
                  Mark resolved
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setChatStatus.mutate("open")}>
                  Reopen
                </Button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages in this conversation.</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className="rounded-lg bg-muted/60 px-4 py-3">
                      <p className="text-xs font-bold">{m.sender_name ?? "User"}</p>
                      <p className="mt-1 text-sm">{m.body}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {new Date(m.created_at as string).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-end gap-2 border-t p-4">
                <Textarea
                  rows={2}
                  placeholder="Reply as admin…"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
                <Button onClick={() => send.mutate()} disabled={!body.trim()}>
                  Send
                </Button>
              </div>
            </>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">Select a conversation.</p>
          )}
        </Card>
      </div>
    </>
  );
}
