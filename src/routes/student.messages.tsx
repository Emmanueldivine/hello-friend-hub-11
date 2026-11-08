import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StudentShell, inputStyle, studentTheme } from "@/components/student/StudentShell";

export const Route = createFileRoute("/student/messages")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Messages | Unieveryhelp" },
      { name: "description", content: "Chat with Unieveryhelp support about your assignments." },
      { property: "og:title", content: "Messages | Unieveryhelp" },
      { property: "og:description", content: "Chat with Unieveryhelp support about your assignments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MessagesPage,
});

type Msg = { id: string; sender_id: string | null; sender_name: string | null; body: string; created_at: string };

function MessagesPage() {
  const navigate = useNavigate();
  const [uid, setUid] = useState("");
  const [name, setName] = useState("Student");
  const [chatId, setChatId] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return navigate({ to: "/student/login", replace: true });
      const id = data.user.id;
      setUid(id);
      const { data: p } = await supabase.from("profiles").select("full_name").eq("id", id).maybeSingle();
      if (p?.full_name) setName(p.full_name);
      // Reuse the student's open support chat, or create one
      let { data: c } = await supabase.from("chats").select("id").eq("student_id", id).is("order_id", null).eq("is_dispute", false).order("created_at").limit(1).maybeSingle();
      if (!c) {
        const ins = await supabase.from("chats").insert({ student_id: id, subject: "Support" }).select("id").single();
        if (ins.error) return setError("Unable to open chat. Please try again.");
        c = ins.data;
      }
      setChatId(c.id);
      const { data: m } = await supabase.from("chat_messages").select("id, sender_id, sender_name, body, created_at").eq("chat_id", c.id).order("created_at");
      setMsgs((m ?? []) as Msg[]);
      channel = supabase
        .channel(`student-chat-${c.id}-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `chat_id=eq.${c.id}` }, (payload) => {
          const row = payload.new as Msg;
          setMsgs((prev) => (prev.some((x) => x.id === row.id) ? prev : [...prev, row]));
        })
        .subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [navigate]);

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
    <StudentShell right={<Link to="/student/dashboard" style={{ color: studentTheme.yellow, fontWeight: 700, textDecoration: "none" }}>← Dashboard</Link>}>
      <h1 style={{ fontSize: 22, margin: "6px 0 12px" }}>Messages</h1>
      <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 18px rgba(10,25,49,.08)", display: "flex", flexDirection: "column", height: "calc(100vh - 170px)", minHeight: 360 }}>
        <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
          {!chatId && !error && <p style={{ textAlign: "center", color: "#64748b" }}><Loader2 size={18} className="animate-spin" style={{ display: "inline" }} /> Opening chat…</p>}
          {chatId && msgs.length === 0 && <p style={{ textAlign: "center", color: "#64748b", fontSize: 14 }}>No messages yet. Say hello — our support team will reply here.</p>}
          {msgs.map((m) => {
            const mine = m.sender_id === uid;
            return (
              <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 8 }}>
                <div style={{ maxWidth: "80%", padding: "8px 12px", borderRadius: 14, background: mine ? studentTheme.navy : studentTheme.paper, color: mine ? "#fff" : studentTheme.navy, border: mine ? 0 : `1px solid ${studentTheme.line}` }}>
                  {!mine && <div style={{ fontSize: 11, fontWeight: 700, color: "#b8860b" }}>{m.sender_name || "Support"}</div>}
                  <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 15 }}>{m.body}</div>
                  <div style={{ fontSize: 10, opacity: 0.6, textAlign: "right", marginTop: 2 }}>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
        {error && <p role="alert" style={{ color: "#b91c1c", fontSize: 13, margin: "0 14px" }}>{error}</p>}
        <form onSubmit={send} style={{ display: "flex", gap: 8, padding: 10, borderTop: `1px solid ${studentTheme.line}` }}>
          <input style={inputStyle} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" maxLength={2000} aria-label="Message" />
          <button type="submit" disabled={sending || !text.trim()} aria-label="Send" style={{ border: 0, borderRadius: 10, background: studentTheme.yellow, color: studentTheme.navy, padding: "0 14px", cursor: "pointer", opacity: sending || !text.trim() ? 0.6 : 1 }}>
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>
      </div>
    </StudentShell>
  );
}
