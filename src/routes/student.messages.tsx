import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StudentShell } from "@/components/student/StudentShell";
import { EmptyState, PageTitle, Skeleton } from "@/components/student/ui";
import { useStudentData, useStudentUser } from "@/lib/student-data";

export const Route = createFileRoute("/student/messages")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Messages | Unieveryhelp" },
      { name: "description", content: "Chat with Unieveryhelp support about your assignments." },
      { property: "og:title", content: "Messages | Unieveryhelp" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <StudentShell>
      <MessagesPage />
    </StudentShell>
  ),
});

type Msg = { id: string; sender_id: string | null; sender_name: string | null; body: string; created_at: string };

function MessagesPage() {
  const { user } = useStudentUser();
  const uid = user?.id ?? "";
  const { profile } = useStudentData(user?.id);
  const name = profile.data?.full_name || "Student";
  const [chatId, setChatId] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!uid) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      let { data: c } = await supabase.from("chats").select("id").eq("student_id", uid).is("order_id", null).eq("is_dispute", false).order("created_at").limit(1).maybeSingle();
      if (!c) {
        const ins = await supabase.from("chats").insert({ student_id: uid, subject: "Support" }).select("id").single();
        if (ins.error) { setLoading(false); return setError("Unable to open chat. Please try again."); }
        c = ins.data;
      }
      setChatId(c.id);
      const { data: m } = await supabase.from("chat_messages").select("id, sender_id, sender_name, body, created_at").eq("chat_id", c.id).order("created_at");
      setMsgs((m ?? []) as Msg[]);
      setLoading(false);
      channel = supabase
        .channel(`student-chat-${c.id}-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `chat_id=eq.${c.id}` }, (payload) => {
          const row = payload.new as Msg;
          setMsgs((prev) => (prev.some((x) => x.id === row.id) ? prev : [...prev, row]));
        })
        .subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [uid]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !chatId || sending) return;
    setSending(true);
    setError("");
    const { data, error: err } = await supabase.from("chat_messages").insert({ chat_id: chatId, sender_id: uid, sender_name: name, body: body.slice(0, 2000) }).select("id, sender_id, sender_name, body, created_at").single();
    setSending(false);
    if (err) return setError("Message not sent. Please try again.");
    setText("");
    setMsgs((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data as Msg]));
  }

  return (
    <>
      <PageTitle title="Messages" sub="Chat with our support team. Replies appear here." />
      <div className="sp-card flex flex-col overflow-hidden" style={{ height: "calc(100vh - 260px)", minHeight: 340 }}>
        <div className="flex-1 overflow-y-auto p-4" aria-live="polite">
          {loading && <div className="grid gap-3" role="status" aria-label="Loading"><Skeleton className="h-12 w-2/3" /><Skeleton className="ml-auto h-12 w-1/2" /><Skeleton className="h-12 w-3/5" /></div>}
          {!loading && msgs.length === 0 && <EmptyState icon={<MessageSquare size={28} />} title="No messages yet" text="Say hello. Our support team will reply here." />}
          {msgs.map((m) => {
            const mine = m.sender_id === uid;
            return (
              <div key={m.id} className={`mb-2 flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[80%] rounded-2xl px-3.5 py-2" style={mine ? { background: "var(--sp-accent)", color: "var(--sp-accent-ink)" } : { background: "var(--sp-surface-2)", border: "var(--sp-border-w) solid var(--sp-line)" }}>
                  {!mine && <div className="text-[11px] font-bold" style={{ color: "var(--sp-accent)" }}>{m.sender_name || "Support"}</div>}
                  <div className="whitespace-pre-wrap break-words text-[14px]">{m.body}</div>
                  <div className="mt-0.5 text-right text-[10px] opacity-70">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
        {error && <p role="alert" className="px-4 text-[13px]" style={{ color: "var(--sp-danger)" }}>{error}</p>}
        <form onSubmit={send} className="sp-line flex gap-2 border-t p-3">
          <input className="sp-field" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" maxLength={2000} aria-label="Message" />
          <button type="submit" disabled={sending || !text.trim()} aria-label="Send" className="sp-btn px-4">
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>
      </div>
    </>
  );
}
