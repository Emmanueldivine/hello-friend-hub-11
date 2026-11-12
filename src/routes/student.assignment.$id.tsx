import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StudentShell } from "@/components/student/StudentShell";
import { Modal } from "@/components/student/Modal";
import { EmptyState, Skeleton, StatusChip, StatusTracker } from "@/components/student/ui";
import { naira } from "@/lib/student-data";
import { studentPortal } from "@/lib/student-api";
import { CANCELLATION_REASONS, cancellationReasonLabel, type CancellationReason } from "@/lib/cancellation-reasons";
import { shortRef } from "@/lib/utils";

export const Route = createFileRoute("/student/assignment/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Assignment | Unieveryhelp" },
      { name: "description", content: "Track the progress of your assignment." },
      { property: "og:title", content: "Assignment | Unieveryhelp" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <StudentShell>
      <AssignmentDetail />
    </StudentShell>
  ),
});

type FileItem = { name?: string; url?: string };
type OrderRow = {
  id: string; reference: string; title: string; course_code: string | null; description: string | null;
  amount: number; status: "pending" | "in_progress" | "under_review" | "completed" | "cancelled"; progress: number; deadline: string | null; created_at: string;
  student_files: FileItem[] | null; cancellation_reason: CancellationReason | null;
};

function AssignmentDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [download, setDownload] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState<CancellationReason | "">("");

  const load = useCallback(async () => {
    const r = await studentPortal({ action: "detail", id });
    if (r.status === 401) return navigate({ to: "/student/login", replace: true });
    if (r.status !== 200) return setState("missing");
    setOrder(r.body.order);
    setDownload(r.body.downloadUrl);
    setState("ready");
  }, [id, navigate]);

  useEffect(() => {
    load();
    const ch = supabase.channel(`order-${id}`).on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `id=eq.${id}` }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, load]);

  async function cancel() {
    if (!reason) return;
    setBusy(true);
    const r = await studentPortal({ action: "cancel", id, reason });
    setBusy(false);
    setConfirm(false);
    if (r.status === 200) { toast.success("Assignment cancelled. Your money is back in your wallet."); setReason(""); qc.invalidateQueries({ queryKey: ["sp"] }); load(); }
    else if (r.status === 409) { toast.error("Work has already started, so this assignment can no longer be cancelled."); load(); }
    else toast.error("Unable to cancel right now. Please try again.");
  }

  const back = <Link to="/student/assignments" className="mb-4 inline-flex items-center gap-2 text-[14px] font-bold"><ArrowLeft size={16} /> My assignments</Link>;

  if (state === "loading") return <>{back}<Skeleton className="h-8 w-2/3" /><Skeleton className="mt-6 h-40 w-full" /><Skeleton className="mt-4 h-56 w-full" /></>;
  if (state === "missing" || !order) return <>{back}<EmptyState icon={<FileText size={28} />} title="Assignment not found" text="It may have been removed, or it does not belong to your account." /></>;

  const done = order.status === "completed";
  const shortNo = shortRef(order.reference);
  const files = Array.isArray(order.student_files) ? order.student_files : [];
  const row = (k: string, v: React.ReactNode) => (
    <div className="sp-line flex justify-between gap-4 border-t py-3 text-[14px] first:border-t-0"><span className="sp-muted">{k}</span><span className="text-right font-semibold">{v}</span></div>
  );

  return (
    <>
      {back}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="min-w-0 text-[24px] font-extrabold leading-tight">{order.title}</h1>
        <StatusChip status={order.status} />
      </div>

      <div className="sp-card mt-5 p-5 md:p-6">
        <StatusTracker status={order.status} />
        {done && download && <a href={download} target="_blank" rel="noreferrer" className="sp-btn sp-btn-block mt-6"><Download size={18} /> Download solution</a>}
        {done && <p className="sp-muted mt-3 text-center text-[12px]">All downloads are deleted after 5 days. Save yours to your device.</p>}
        {order.status === "cancelled" && order.cancellation_reason && (
          <p className="sp-line mt-5 border-t pt-4 text-[13px]">Cancellation reason: {cancellationReasonLabel(order.cancellation_reason)}</p>
        )}
      </div>

      <div className="sp-card mt-4 px-5 py-2 md:px-6">
        {row("Order number", <span>{shortNo} <button onClick={() => { navigator.clipboard.writeText(shortNo); toast.success("Order number copied"); }} className="sp-line ml-2 rounded-lg border px-2 py-0.5 text-[12px]">Copy</button></span>)}
        {row("Course", order.course_code || "-")}
        {row("Price", naira(order.amount))}
        {row("Submitted", new Date(order.created_at).toLocaleString())}
        {row("Deadline", order.deadline ? new Date(order.deadline).toLocaleString() : "-")}
        {row("Files", files.length ? files.map((f, i) => f.url ? <a key={i} href={f.url} target="_blank" rel="noreferrer" className="block underline">{f.name || `File ${i + 1}`}</a> : <span key={i} className="block">{f.name || `File ${i + 1}`}</span>) : "None")}
        <div className="sp-line border-t py-3">
          <div className="sp-muted text-[14px]">Description</div>
          <p className="mt-1 whitespace-pre-wrap text-[14px]">{order.description || "-"}</p>
        </div>
      </div>

      {order.status === "pending" && (
        <div className="sp-card mt-4 p-5 md:p-6">
          <p className="text-[14px]">You can cancel until a staff member starts working on it. Your money returns to your wallet.</p>
          <button className="sp-btn sp-btn-ghost mt-4" onClick={() => setConfirm(true)}>Cancel assignment</button>
        </div>
      )}

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Cancel assignment">
        <h2 className="text-[18px] font-extrabold">Cancel this assignment?</h2>
        <p className="sp-muted mt-1 text-[13px]">{naira(order.amount)} will be refunded to your wallet.</p>
        <fieldset className="mt-4 grid gap-2">
          <legend className="mb-2 text-[13px] font-bold">Why are you cancelling?</legend>
          {CANCELLATION_REASONS.map((r) => (
            <label key={r.value} className="flex cursor-pointer items-start gap-3 rounded-xl p-3 text-[14px]" style={{ border: "var(--sp-border-w) solid " + (reason === r.value ? "var(--sp-accent)" : "var(--sp-line)") }}>
              <input type="radio" name="reason" className="mt-1" checked={reason === r.value} onChange={() => setReason(r.value)} /> {r.label}
            </label>
          ))}
        </fieldset>
        <div className="mt-5 flex gap-3">
          <button className="sp-btn sp-btn-ghost flex-1" onClick={() => setConfirm(false)}>Keep it</button>
          <button className="sp-btn sp-btn-danger flex-1" disabled={busy || !reason} onClick={cancel}>{busy ? "Cancelling…" : "Yes, cancel"}</button>
        </div>
      </Modal>
    </>
  );
}
