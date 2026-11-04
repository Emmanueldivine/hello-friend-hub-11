import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StudentShell, btnStyle, inputStyle, studentTheme } from "@/components/student/StudentShell";
import { studentPortal } from "@/lib/student-api";

export const Route = createFileRoute("/student/wallet")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { required?: number | undefined } => ({ required: s["required"] ? Number(s["required"]) : undefined }),
  head: () => ({
    meta: [
      { title: "My Wallet | Unieveryhelp" },
      { name: "description", content: "Fund your Unieveryhelp wallet and see your transactions." },
      { property: "og:title", content: "My Wallet | Unieveryhelp" },
      { property: "og:description", content: "Fund your Unieveryhelp wallet and see your transactions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WalletPage,
});

type Tx = { id: string; amount: number; type: string; created_at: string };

function WalletPage() {
  const navigate = useNavigate();
  const { required } = Route.useSearch();
  const [balance, setBalance] = useState(0);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [funded, setFunded] = useState(false);

  async function load() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return navigate({ to: "/student/login", replace: true });
    const [w, t] = await Promise.all([
      supabase.from("wallets").select("balance").eq("user_id", data.user.id).maybeSingle(),
      supabase.from("transactions").select("id, amount, type, created_at").eq("user_id", data.user.id).order("created_at", { ascending: false }).limit(20),
    ]);
    setBalance(Number(w.data?.balance ?? 0));
    setTxs((t.data ?? []) as Tx[]);
  }
  useEffect(() => { load(); }, []);

  async function fund(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt < 100 || busy) return;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 1200));
    const { body } = await studentPortal({ action: "topup", amount: amt });
    setBusy(false);
    if (body.ok) { setAmount(""); setFunded(true); load(); }
  }

  return (
    <StudentShell right={<Link to="/student/dashboard" style={{ color: studentTheme.yellow }}>Dashboard</Link>}>
      <div style={{ background: studentTheme.navy, color: "#fff", borderRadius: 16, padding: 18 }}>
        <div style={{ opacity: 0.8, fontSize: 13 }}>Wallet balance</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: studentTheme.yellow }}>₦{balance.toLocaleString()}</div>
      </div>
      {required && !funded && <p style={{ color: "#b45309" }}>Insufficient balance. You need ₦{required.toLocaleString()} for this assignment.</p>}
      <form onSubmit={fund} style={{ display: "grid", gap: 10, marginTop: 14 }}>
        <input aria-label="Amount" inputMode="numeric" placeholder="Enter amount e.g 2000" style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 9))} />
        <button type="submit" style={btnStyle} disabled={busy}>{busy ? "Processing…" : "Fund Wallet"}</button>
      </form>
      {funded && required && (
        <button style={{ ...btnStyle, marginTop: 10, background: "#059669", color: "#fff" }} onClick={() => navigate({ to: "/student/order" })}>Return to Assignment</button>
      )}
      <h3 style={{ marginTop: 22 }}>Transactions</h3>
      {txs.length === 0 && <p style={{ fontSize: 14 }}>No transactions yet.</p>}
      {txs.map((t) => (
        <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${studentTheme.line}`, fontSize: 14 }}>
          <span>{t.type === "topup" ? "Wallet top-up" : "Assignment payment"} · {new Date(t.created_at).toLocaleDateString()}</span>
          <b style={{ color: t.type === "topup" ? "#059669" : "#dc2626" }}>{t.type === "topup" ? "+" : "-"}₦{Number(t.amount).toLocaleString()}</b>
        </div>
      ))}
    </StudentShell>
  );
}
