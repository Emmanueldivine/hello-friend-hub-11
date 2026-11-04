import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StudentShell, btnStyle, inputStyle, studentTheme } from "@/components/student/StudentShell";
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
      { property: "og:description", content: "Post your assignment and pay from your Unieveryhelp wallet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrderPage,
});

function OrderPage() {
  const navigate = useNavigate();
  const [f, setF] = useState({ title: "", courseCode: "", description: "", track: "cheap", pages: 1, hours: "48", school: "", department: "", level: "" });
  const [hasProfile, setHasProfile] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ reference: string; price: number; deadline: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return navigate({ to: "/student/login", replace: true });
      const { data: p } = await supabase.from("profiles").select("school, department, level").eq("id", data.user.id).maybeSingle();
      setHasProfile(!!(p?.school && p?.department && p?.level));
    });
  }, [navigate]);

  const price = priceFor(f.track, f.pages, f.hours);
  const academicOk = hasProfile || (f.school.trim() && f.department.trim() && f.level.trim());
  const ready = academicOk && f.title.trim().length >= 3 && f.courseCode.trim().length >= 2 && f.description.trim().length >= 10;
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: k === "pages" ? Number(e.target.value) : e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    await new Promise((r) => setTimeout(r, 1200));
    const { status, body } = await studentPortal({ action: "order", ...f });
    setBusy(false);
    if (status === 402) return navigate({ to: "/student/wallet", search: { required: body.required } });
    if (!body.ok) return setError("Unable to submit assignment. Please try again.");
    setDone({ reference: body.order.reference, price: body.order.price, deadline: body.order.deadline });
  }

  return (
    <StudentShell right={<Link to="/student/dashboard" style={{ color: studentTheme.yellow }}>Dashboard</Link>}>
      <h1 style={{ fontSize: 22 }}>Post an assignment</h1>
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        {!hasProfile && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 14, display: "grid", gap: 8 }}>
            <strong>Academic profile (asked once)</strong>
            <input aria-label="School" placeholder="School" style={inputStyle} value={f.school} onChange={set("school")} />
            <input aria-label="Department" placeholder="Department" style={inputStyle} value={f.department} onChange={set("department")} />
            <input aria-label="Level" placeholder="Level e.g 200" style={inputStyle} value={f.level} onChange={set("level")} />
          </div>
        )}
        <input aria-label="Title" placeholder="Assignment title" style={inputStyle} value={f.title} onChange={set("title")} />
        <input aria-label="Course code" placeholder="Course code e.g GST101" style={inputStyle} value={f.courseCode} onChange={set("courseCode")} />
        <textarea aria-label="Description" placeholder="Describe what you need" rows={5} style={inputStyle} value={f.description} onChange={set("description")} />
        <select aria-label="Type" style={inputStyle} value={f.track} onChange={set("track")}>
          <option value="cheap">Cheap Text Work</option>
          <option value="technical">Technical</option>
        </select>
        <select aria-label="Pages" style={inputStyle} value={f.pages} onChange={set("pages")}>
          {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n === 7 ? "7+ pages" : `${n} page${n > 1 ? "s" : ""}`}</option>)}
        </select>
        <select aria-label="Deadline" style={inputStyle} value={f.hours} onChange={set("hours")}>
          <option value="24">24 hours</option><option value="48">48 hours</option><option value="72">72 hours</option>
        </select>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Price: ₦{price.toLocaleString()}</div>
        {error && <p style={{ color: "#dc2626", margin: 0 }}>{error}</p>}
        <button type="submit" disabled={!ready || busy} style={{ ...btnStyle, background: ready ? studentTheme.yellow : "#cbd5e1", cursor: ready ? "pointer" : "not-allowed" }}>
          {busy ? "Submitting…" : "Post & Pay"}
        </button>
      </form>
      {done && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,25,49,.5)", display: "grid", placeItems: "center", padding: 18 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: 22, maxWidth: 380, width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 34, color: "#059669" }}>✓</div>
            <h2>Order placed</h2>
            <p>Order <b>{shortRef(done.reference)}</b> · ₦{done.price.toLocaleString()}</p>
            <p style={{ fontSize: 13 }}>Deadline: {new Date(done.deadline).toLocaleString()}</p>
            <button style={btnStyle} onClick={() => navigate({ to: "/student/dashboard" })}>View My Assignments</button>
          </div>
        </div>
      )}
    </StudentShell>
  );
}
