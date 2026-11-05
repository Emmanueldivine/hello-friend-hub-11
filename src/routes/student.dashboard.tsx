import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StudentShell, studentTheme } from "@/components/student/StudentShell";
import { shortRef } from "@/lib/utils";

export const Route = createFileRoute("/student/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My Dashboard | Unieveryhelp" },
      { name: "description", content: "Your Unieveryhelp wallet, profile and assignments." },
      { property: "og:title", content: "My Dashboard | Unieveryhelp" },
      { property: "og:description", content: "Your Unieveryhelp wallet, profile and assignments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentDashboard,
});

type Order = { id: string; reference: string; title: string; amount: number; status: string; progress: number; created_at: string };
type Profile = { full_name: string | null; username: string | null; school: string | null; department: string | null; level: string | null };

const statusLabel: Record<string, string> = { pending: "Received", in_progress: "In Progress", under_review: "Under Review", completed: "Completed", cancelled: "Cancelled" };

function StudentDashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [balance, setBalance] = useState(0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let uid = "";
    let channel: ReturnType<typeof supabase.channel> | null = null;
    async function load() {
      const [p, w, o] = await Promise.all([
        supabase.from("profiles").select("full_name, username, school, department, level").eq("id", uid).maybeSingle(),
        supabase.from("wallets").select("balance").eq("user_id", uid).maybeSingle(),
        supabase.from("orders").select("id, reference, title, amount, status, progress, created_at").eq("student_id", uid).order("created_at", { ascending: false }),
      ]);
      setProfile(p.data as Profile | null);
      setBalance(Number(w.data?.balance ?? 0));
      setOrders((o.data ?? []) as Order[]);
      setReady(true);
    }
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        navigate({ to: "/student/login", replace: true });
        return;
      }
      uid = data.user.id;
      load();
      channel = supabase
        .channel(`student-${uid}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `student_id=eq.${uid}` }, load)
        .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${uid}` }, load)
        .subscribe();
    });
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [navigate]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/student/login", replace: true });
  }

  const card = { background: "#fff", borderRadius: 16, padding: 18, marginBottom: 14, boxShadow: "0 4px 18px rgba(10,25,49,.06)" };
  const name = profile?.full_name || profile?.username || "Student";

  return (
    <StudentShell right={<button onClick={signOut} style={{ background: "none", border: `1px solid ${studentTheme.yellow}`, color: studentTheme.yellow, borderRadius: 10, padding: "6px 12px", cursor: "pointer" }}>Sign out</button>}>
      {!ready ? (
        <p>Loading…</p>
      ) : (
        <>
          <h1 style={{ fontSize: 22 }}>Hi, {name} 👋</h1>
          <div style={{ ...card, background: studentTheme.navy, color: "#fff" }}>
            <div style={{ opacity: 0.8, fontSize: 13 }}>Wallet balance</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: studentTheme.yellow }}>₦{balance.toLocaleString()}</div>
          </div>
          <div style={card}>
            <strong>Academic profile</strong>
            <p style={{ margin: "6px 0 0", fontSize: 14 }}>
              {profile?.school ? `${profile.school} · ${profile.department ?? ""} · ${profile.level ?? ""}` : "Not completed yet — it will be asked on your first order."}
            </p>
          </div>
          <div style={card}>
            <strong>My assignments ({orders.length})</strong>
            {orders.length === 0 && <p style={{ fontSize: 14 }}>No assignments yet.</p>}
            {orders.map((o) => (
              <Link key={o.id} to="/student/assignment/$id" params={{ id: o.id }} style={{ borderTop: `1px solid ${studentTheme.line}`, padding: "10px 0", display: "flex", justifyContent: "space-between", gap: 10, color: "inherit", textDecoration: "none" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{o.title}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Order {shortRef(o.reference)} · ₦{Number(o.amount).toLocaleString()}</div>
                </div>
                <div style={{ minWidth: 110, textAlign: "right" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{statusLabel[o.status] ?? o.status}</span>
                  <div style={{ height: 6, background: studentTheme.line, borderRadius: 6, marginTop: 6 }}>
                    <div style={{ height: 6, borderRadius: 6, width: `${o.status === "completed" ? 100 : Math.min(o.progress, 90)}%`, background: o.status === "completed" ? "#059669" : o.status === "under_review" ? "#7c3aed" : o.progress > 20 ? "#f97316" : "#94a3b8" }} />
                  </div>
                </div>
              </Link>
            ))}
            <p style={{ fontSize: 13, marginTop: 10 }}>
              <Link to="/student/order" style={{ fontWeight: 700, color: studentTheme.navy }}>+ Post an assignment</Link> · <Link to="/student/wallet" search={{}} style={{ fontWeight: 700, color: studentTheme.navy }}>Wallet</Link> · <a href="/" style={{ color: studentTheme.navy }}>Main portal</a>
            </p>
          </div>
        </>
      )}
    </StudentShell>
  );
}
