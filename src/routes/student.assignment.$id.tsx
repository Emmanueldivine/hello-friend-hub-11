import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StudentShell, studentTheme } from "@/components/student/StudentShell";
import { studentPortal } from "@/lib/student-api";
import { shortRef } from "@/lib/utils";

export const Route = createFileRoute("/student/assignment/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Assignment Details | Unieveryhelp" },
      { name: "description", content: "Track progress, download your solution or cancel your assignment." },
      { property: "og:title", content: "Assignment Details | Unieveryhelp" },
      { property: "og:description", content: "Track progress, download your solution or cancel your assignment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssignmentDetail,
});

type FileItem = { name?: string; url?: string };
type Order = {
  id: string; reference: string; title: string; course_code: string | null; description: string | null;
  amount: number; status: string; progress: number; deadline: string | null; created_at: string;
  student_files: FileItem[] | null;
};

const statusLabel: Record<string, string> = { pending: "Received", in_progress: "In Progress", under_review: "Under Review", completed: "Completed", cancelled: "Cancelled" };

function AssignmentDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [name, setName] = useState("");
  const [download, setDownload] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await studentPortal({ action: "detail", id });
    if (r.status === 401) return navigate({ to: "/student/login", replace: true });
    if (r.status !== 200) return setState("missing");
    setOrder(r.body.order);
    setName(r.body.student?.full_name || r.body.student?.username || "");
    setDownload(r.body.downloadUrl);
    setState("ready");
  }, [id, navigate]);

  useEffect(() => {
    load();
    const ch = supabase.channel(`order-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `id=eq.${id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, load]);

  async function cancel() {
    if (!confirm("Cancel this assignment? The full amount goes back to your wallet.")) return;
    setBusy(true);
    const r = await studentPortal({ action: "cancel", id });
    setBusy(false);
    if (r.status === 200) { toast.success("Assignment cancelled. Money returned to your wallet."); load(); }
    else if (r.status === 409) { toast.error("Work has already started, so this assignment can no longer be cancelled."); load(); }
    else toast.error("Unable to cancel right now. Please try again.");
  }

  const card = { background: "#fff", borderRadius: 16, padding: 18, marginBottom: 14, boxShadow: "0 4px 18px rgba(10,25,49,.06)" };
  const row = (k: string, v: React.ReactNode) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderTop: `1px solid ${studentTheme.line}`, fontSize: 14 }}>
      <span style={{ opacity: 0.7 }}>{k}</span><span style={{ fontWeight: 600, textAlign: "right" }}>{v}</span>
    </div>
  );

  if (state === "loading") return <StudentShell><p>Loading…</p></StudentShell>;
  if (state === "missing" || !order) return <StudentShell><p>Assignment not found.</p><Link to="/student/dashboard">Back to dashboard</Link></StudentShell>;

  const done = order.status === "completed";
  const pct = done ? 100 : Math.min(order.progress, 90);
  const color = done ? "#059669" : order.status === "under_review" ? "#7c3aed" : order.progress > 20 ? "#f97316" : "#94a3b8";
  const shortNo = shortRef(order.reference);
  const files = Array.isArray(order.student_files) ? order.student_files : [];

  return (
    <StudentShell>
      <Link to="/student/dashboard" style={{ color: studentTheme.navy, fontWeight: 700, fontSize: 14 }}>← My assignments</Link>
      <h1 style={{ fontSize: 22, margin: "12px 0" }}>{order.title}</h1>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14 }}>
          <span>{statusLabel[order.status] ?? order.status}</span><span>{order.status === "cancelled" ? "—" : `${pct}%`}</span>
        </div>
        <div style={{ height: 10, background: studentTheme.line, borderRadius: 8, marginTop: 8 }}>
          <div style={{ height: 10, borderRadius: 8, width: `${order.status === "cancelled" ? 0 : pct}%`, background: color, transition: "width .6s" }} />
        </div>
        {done && download && (
          <a href={download} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 14, textAlign: "center", background: "#059669", color: "#fff", borderRadius: 12, padding: 12, fontWeight: 700, textDecoration: "none" }}>Download solution</a>
        )}
        {done && <p style={{ fontSize: 12, marginTop: 8, opacity: 0.75 }}>All downloads delete after 5 days, save to your device.</p>}
      </div>
      <div style={card}>
        {row("Order number", <span>{shortNo} <button onClick={() => { navigator.clipboard.writeText(shortNo); toast.success("Order number copied"); }} style={{ marginLeft: 6, border: `1px solid ${studentTheme.line}`, background: "none", borderRadius: 8, padding: "2px 8px", cursor: "pointer", fontSize: 12 }}>Copy</button></span>)}
        {row("Student", name || "—")}
        {row("Course", order.course_code || "—")}
        {row("Price", `₦${Number(order.amount).toLocaleString()}`)}
        {row("Submitted", new Date(order.created_at).toLocaleString())}
        {row("Deadline", order.deadline ? new Date(order.deadline).toLocaleString() : "—")}
        {row("Files", files.length ? files.map((f, i) => f.url ? <a key={i} href={f.url} target="_blank" rel="noreferrer" style={{ display: "block" }}>{f.name || `File ${i + 1}`}</a> : <span key={i} style={{ display: "block" }}>{f.name || `File ${i + 1}`}</span>) : "None")}
        <div style={{ paddingTop: 10, borderTop: `1px solid ${studentTheme.line}` }}>
          <div style={{ opacity: 0.7, fontSize: 14 }}>Description</div>
          <p style={{ whiteSpace: "pre-wrap", fontSize: 14, margin: "6px 0 0" }}>{order.description || "—"}</p>
        </div>
      </div>
      {order.status === "pending" && (
        <div style={card}>
          <p style={{ fontSize: 13, margin: "0 0 10px" }}>You can cancel until a staff member starts working on it. Your money returns to your wallet.</p>
          <button disabled={busy} onClick={cancel} style={{ width: "100%", background: "#dc2626", color: "#fff", border: "none", borderRadius: 12, padding: 12, fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "Cancelling…" : "Cancel assignment"}</button>
        </div>
      )}
    </StudentShell>
  );
}
