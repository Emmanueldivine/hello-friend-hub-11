import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { StudentShell } from "@/components/student/StudentShell";
import { Modal } from "@/components/student/Modal";
import { Skeleton } from "@/components/student/ui";
import { naira, useStudentData, useStudentUser } from "@/lib/student-data";
import { studentPortal } from "@/lib/student-api";
import { priceFor } from "@/lib/student-pricing";
import { shortRef } from "@/lib/utils";

export const Route = createFileRoute("/student/order")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Post an Assignment | Unieveryhelp" },
      { name: "description", content: "Post your assignment and pay from your Unieveryhelp wallet." },
      { property: "og:title", content: "Post an Assignment | Unieveryhelp" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <StudentShell>
      <OrderForm />
    </StudentShell>
  ),
});

function OrderForm() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useStudentUser();
  const { profile, wallet } = useStudentData(user?.id);
  const [f, setF] = useState({ title: "", courseCode: "", description: "", track: "cheap", pages: 1, hours: "48", school: "", department: "", level: "" });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ reference: string; price: number; deadline: string } | null>(null);

  const hasProfile = !!(profile.data?.school && profile.data?.department && profile.data?.level);
  const price = priceFor(f.track, f.pages, f.hours);
  const balance = wallet.data ?? 0;
  const short = Math.max(0, price - balance);
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: k === "pages" ? Number(e.target.value) : e.target.value });
  const blur = (k: string) => () => setTouched({ ...touched, [k]: true });

  const errors: Record<string, string> = {};
  if (f.title.trim().length < 3) errors["title"] = "Give your assignment a title (at least 3 characters).";
  if (f.courseCode.trim().length < 2) errors["courseCode"] = "Enter the course code, e.g GST101.";
  if (f.description.trim().length < 10) errors["description"] = "Describe what you need (at least 10 characters).";
  if (!hasProfile) {
    if (!f.school.trim()) errors["school"] = "Enter your school.";
    if (!f.department.trim()) errors["department"] = "Enter your department.";
    if (!f.level.trim()) errors["level"] = "Enter your level, e.g 200.";
  }
  const ready = Object.keys(errors).length === 0;
  const deadline = new Date(Date.now() + Number(f.hours) * 36e5);

  const err = (k: string) => touched[k] && errors[k] ? <p role="alert" className="mt-1 text-[12px] font-medium" style={{ color: "var(--sp-danger)" }}>{errors[k]}</p> : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return setTouched({ title: true, courseCode: true, description: true, school: true, department: true, level: true });
    if (busy) return;
    if (short > 0) {
      toast.error(`You need ${naira(short)} more in your wallet.`);
      return navigate({ to: "/student/wallet", search: { required: price } });
    }
    setBusy(true);
    const { status, body } = await studentPortal({ action: "order", ...f });
    setBusy(false);
    if (status === 402) return navigate({ to: "/student/wallet", search: { required: body.required ?? price } });
    if (!body.ok) return toast.error("Unable to submit assignment. Please try again.");
    qc.invalidateQueries({ queryKey: ["sp"] });
    setDone({ reference: body.order.reference, price: body.order.price, deadline: body.order.deadline });
  }

  return (
    <>
      <h1 className="text-[24px] font-extrabold md:text-[28px]">Post an assignment</h1>
      <p className="sp-muted mt-1 text-[14px]">Fill in the details, review the price, and pay from your wallet.</p>
      <form onSubmit={submit} noValidate className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="sp-card grid gap-4 p-5 md:p-6">
          {profile.isLoading && <Skeleton className="h-24 w-full" />}
          {!profile.isLoading && !hasProfile && (
            <fieldset className="grid gap-3 rounded-xl p-4" style={{ background: "var(--sp-surface-2)" }}>
              <legend className="px-1 text-[13px] font-bold">Academic profile (asked once)</legend>
              <div><input aria-label="School" placeholder="School" className="sp-field" value={f.school} onChange={set("school")} onBlur={blur("school")} />{err("school")}</div>
              <div><input aria-label="Department" placeholder="Department" className="sp-field" value={f.department} onChange={set("department")} onBlur={blur("department")} />{err("department")}</div>
              <div><input aria-label="Level" placeholder="Level e.g 200" className="sp-field" value={f.level} onChange={set("level")} onBlur={blur("level")} />{err("level")}</div>
            </fieldset>
          )}
          <div><label className="sp-label" htmlFor="title">Assignment title</label><input id="title" className="sp-field" value={f.title} onChange={set("title")} onBlur={blur("title")} maxLength={150} />{err("title")}</div>
          <div><label className="sp-label" htmlFor="code">Course code</label><input id="code" className="sp-field" placeholder="e.g GST101" value={f.courseCode} onChange={set("courseCode")} onBlur={blur("courseCode")} maxLength={20} />{err("courseCode")}</div>
          <div><label className="sp-label" htmlFor="desc">Description</label><textarea id="desc" rows={5} className="sp-field" placeholder="Describe what you need" value={f.description} onChange={set("description")} onBlur={blur("description")} maxLength={5000} />{err("description")}</div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label className="sp-label" htmlFor="track">Type</label>
              <select id="track" className="sp-field" value={f.track} onChange={set("track")}><option value="cheap">Cheap Text Work</option><option value="technical">Technical</option></select></div>
            <div><label className="sp-label" htmlFor="pages">Pages</label>
              <select id="pages" className="sp-field" value={f.pages} onChange={set("pages")}>{[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n === 7 ? "7+ pages" : `${n} page${n > 1 ? "s" : ""}`}</option>)}</select></div>
            <div><label className="sp-label" htmlFor="hours">Deadline</label>
              <select id="hours" className="sp-field" value={f.hours} onChange={set("hours")}><option value="24">24 hours</option><option value="48">48 hours</option><option value="72">72 hours</option></select></div>
          </div>
        </div>

        <aside className="sp-card h-fit p-5 lg:sticky lg:top-24" aria-live="polite">
          <h2 className="text-[15px] font-bold">Order summary</h2>
          <dl className="mt-4 grid gap-3 text-[14px]">
            <div className="flex justify-between"><dt className="sp-muted">Price</dt><dd className="text-[22px] font-extrabold" style={{ color: "var(--sp-accent)" }}>{naira(price)}</dd></div>
            <div className="flex justify-between"><dt className="sp-muted">Due by</dt><dd className="font-semibold">{deadline.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}</dd></div>
            <div className="sp-line flex justify-between border-t pt-3"><dt className="sp-muted">Wallet</dt><dd className="font-semibold">{wallet.isLoading ? "…" : naira(balance)}</dd></div>
          </dl>
          {short > 0 && !wallet.isLoading && (
            <p className="mt-3 rounded-lg p-3 text-[12px] font-semibold" style={{ background: "var(--sp-warn-soft)", color: "var(--sp-warn)" }}>You need {naira(short)} more. We will take you to fund your wallet.</p>
          )}
          <button type="submit" disabled={busy} className="sp-btn sp-btn-block mt-5">
            {busy && <Loader2 size={18} className="animate-spin" />}
            {busy ? "Submitting…" : short > 0 ? "Fund wallet to continue" : `Post & Pay ${naira(price)}`}
          </button>
        </aside>
      </form>

      <Modal open={!!done} onClose={() => navigate({ to: "/student/assignments" })} title="Order placed">
        {done && (
          <div className="text-center">
            <CheckCircle2 size={44} className="mx-auto" style={{ color: "var(--sp-ok)" }} />
            <h2 className="mt-3 text-[20px] font-extrabold">Order placed</h2>
            <p className="mt-2 text-[14px]">Order <b>{shortRef(done.reference)}</b> · {naira(done.price)}</p>
            <p className="sp-muted mt-1 text-[13px]">Deadline: {new Date(done.deadline).toLocaleString()}</p>
            <Link to="/student/assignments" className="sp-btn sp-btn-block mt-5">View My Assignments</Link>
          </div>
        )}
      </Modal>
    </>
  );
}
