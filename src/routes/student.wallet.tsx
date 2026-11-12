import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Loader2, Receipt, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { StudentShell } from "@/components/student/StudentShell";
import { EmptyState, PageTitle, Skeleton } from "@/components/student/ui";
import { naira, useStudentData, useStudentUser } from "@/lib/student-data";
import { studentPortal } from "@/lib/student-api";

export const Route = createFileRoute("/student/wallet")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { required?: number | undefined } => ({ required: s["required"] ? Number(s["required"]) : undefined }),
  head: () => ({
    meta: [
      { title: "My Wallet | Unieveryhelp" },
      { name: "description", content: "Fund your Unieveryhelp wallet and see your transactions." },
      { property: "og:title", content: "My Wallet | Unieveryhelp" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <StudentShell>
      <WalletPage />
    </StudentShell>
  ),
});

const FILTERS = [
  { value: "all", label: "All" },
  { value: "topup", label: "Top-ups" },
  { value: "payment", label: "Payments" },
  { value: "refund", label: "Refunds" },
] as const;
const QUICK = [1000, 2000, 5000, 10000];

function WalletPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { required } = Route.useSearch();
  const { user } = useStudentUser();
  const { wallet, txs } = useStudentData(user?.id);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [funded, setFunded] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");

  const amt = Number(amount);
  const invalid = amount !== "" && amt < 100;
  const all = txs.data ?? [];
  const shown = filter === "all" ? all : all.filter((t) => (filter === "payment" ? t.type !== "topup" && t.type !== "refund" : t.type === filter));

  async function fund(e: React.FormEvent) {
    e.preventDefault();
    if (!amt || amt < 100 || busy) return;
    setBusy(true);
    const { body } = await studentPortal({ action: "topup", amount: amt });
    setBusy(false);
    if (!body.ok) {
      toast.error("Unable to fund your wallet. Please try again.");
      return;
    }
    setAmount("");
    setFunded(true);
    toast.success(`${naira(amt)} added to your wallet.`);
    qc.invalidateQueries({ queryKey: ["sp"] });
  }

  return (
    <>
      <PageTitle title="My Wallet" sub="Fund your wallet and review every transaction." />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="grid h-fit gap-4">
          <div className="sp-hero p-6" style={{ boxShadow: "var(--sp-glow)" }}>
            <div className="text-[13px] opacity-80">Wallet balance</div>
            {wallet.isLoading ? <Skeleton className="mt-2 h-10 w-44" /> : <div className="mt-1 text-[34px] font-extrabold" style={{ color: "var(--sp-accent)" }}>{naira(wallet.data)}</div>}
          </div>

          <form onSubmit={fund} className="sp-card p-5">
            <h2 className="text-[15px] font-bold">Fund wallet</h2>
            {required && !funded && (
              <p className="mt-3 rounded-lg p-3 text-[13px] font-semibold" style={{ background: "var(--sp-warn-soft)", color: "var(--sp-warn)" }}>
                Insufficient balance. You need {naira(required)} for this assignment.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {QUICK.map((q) => (
                <button key={q} type="button" onClick={() => setAmount(String(q))} className="rounded-full px-3 py-1.5 text-[13px] font-bold"
                  style={{ border: "var(--sp-border-w) solid " + (amt === q ? "var(--sp-accent)" : "var(--sp-line)"), background: amt === q ? "var(--sp-accent-soft)" : "transparent" }}>
                  {naira(q)}
                </button>
              ))}
            </div>
            <label className="sp-label mt-4" htmlFor="amount">Amount</label>
            <input id="amount" className="sp-field" inputMode="numeric" placeholder="Enter amount e.g 2000" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 9))} aria-invalid={invalid} />
            {invalid && <p role="alert" className="mt-1 text-[12px] font-medium" style={{ color: "var(--sp-danger)" }}>The minimum is {naira(100)}.</p>}
            <button type="submit" disabled={busy || !amt || invalid} className="sp-btn sp-btn-block mt-4">
              {busy && <Loader2 size={18} className="animate-spin" />} {busy ? "Processing…" : "Fund wallet"}
            </button>
            {funded && required && <button type="button" className="sp-btn sp-btn-block mt-3" style={{ background: "var(--sp-ok)", color: "#04130c" }} onClick={() => navigate({ to: "/student/order" })}>Return to assignment</button>}
          </form>
        </div>

        <div>
          <h2 className="text-[18px] font-bold">Transactions</h2>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter transactions">
            {FILTERS.map((f) => (
              <button key={f.value} role="tab" aria-selected={filter === f.value} onClick={() => setFilter(f.value)} className="flex-none rounded-full px-4 py-2 text-[13px] font-bold"
                style={{ background: filter === f.value ? "var(--sp-accent)" : "var(--sp-surface)", color: filter === f.value ? "var(--sp-accent-ink)" : "var(--sp-ink)", border: "var(--sp-border-w) solid " + (filter === f.value ? "var(--sp-accent)" : "var(--sp-line)") }}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="mt-4">
            {txs.isLoading ? (
              <div className="grid gap-3" role="status" aria-label="Loading">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[68px] w-full" />)}</div>
            ) : shown.length === 0 ? (
              <EmptyState icon={<Receipt size={28} />} title="No transactions yet" text="Fund your wallet and your payments, top-ups and refunds will show up here." />
            ) : (
              <ul className="grid gap-3">
                {shown.map((t) => {
                  const credit = t.type === "topup" || t.type === "refund";
                  const Icon = t.type === "refund" ? RotateCcw : credit ? ArrowDownLeft : ArrowUpRight;
                  const pending = t.status !== "success" && t.status !== "completed" && t.status !== "paid";
                  return (
                    <li key={t.id} className="sp-card flex items-center gap-3 p-4">
                      <span className="grid h-10 w-10 flex-none place-items-center rounded-full" style={{ background: credit ? "var(--sp-ok-soft)" : "var(--sp-danger-soft)", color: credit ? "var(--sp-ok)" : "var(--sp-danger)" }}><Icon size={18} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-semibold">{t.type === "topup" ? "Wallet top-up" : t.type === "refund" ? "Refund" : "Assignment payment"}</div>
                        <div className="sp-muted text-[12px]">{new Date(t.created_at).toLocaleString()}</div>
                      </div>
                      <div className="text-right">
                        <b style={{ color: credit ? "var(--sp-ok)" : "var(--sp-danger)" }}>{credit ? "+" : "-"}{naira(t.amount)}</b>
                        {pending && <div><span className="sp-chip sp-chip-pending mt-1">{t.status}</span></div>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
