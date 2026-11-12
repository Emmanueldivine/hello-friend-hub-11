import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Plus, Wallet } from "lucide-react";
import { StudentShell } from "@/components/student/StudentShell";
import { AssignmentCard } from "@/components/student/AssignmentCard";
import { CardSkeletons, EmptyState, Skeleton } from "@/components/student/ui";
import { naira, useStudentData, useStudentUser } from "@/lib/student-data";

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
  component: () => (
    <StudentShell>
      <Dashboard />
    </StudentShell>
  ),
});

function Dashboard() {
  const { user } = useStudentUser();
  const { profile, wallet, orders } = useStudentData(user?.id);
  const all = orders.data ?? [];
  const active = all.filter((o) => ["pending", "in_progress", "under_review"].includes(o.status)).length;
  const done = all.filter((o) => o.status === "completed").length;
  const spent = all.filter((o) => o.status !== "cancelled").reduce((s, o) => s + Number(o.amount), 0);
  const first = (profile.data?.full_name || profile.data?.username || "").split(" ")[0];

  const stats = [
    { label: "Total", value: all.length },
    { label: "In progress", value: active },
    { label: "Completed", value: done },
    { label: "Spent", value: naira(spent) },
  ];

  return (
    <>
      <h1 className="text-[26px] font-extrabold tracking-tight md:text-[30px]">Welcome back{first ? `, ${first}` : ""}</h1>
      <p className="sp-muted mt-1 text-[14px]">Here is an overview of your work.</p>

      <div className="sp-hero mt-6 flex flex-wrap items-center justify-between gap-4 p-6" style={{ boxShadow: "var(--sp-glow)" }}>
        <div>
          <div className="flex items-center gap-2 text-[13px] opacity-80"><Wallet size={16} /> Wallet balance</div>
          {wallet.isLoading ? <Skeleton className="mt-2 h-9 w-40" /> : <div className="mt-1 text-[32px] font-extrabold" style={{ color: "var(--sp-accent)" }}>{naira(wallet.data)}</div>}
        </div>
        <Link to="/student/wallet" className="sp-btn">Fund wallet</Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="sp-card p-4">
            {orders.isLoading ? <Skeleton className="h-7 w-16" /> : <b className="text-[22px]">{s.value}</b>}
            <p className="sp-muted mt-1 text-[12px]">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-[18px] font-bold">Recent assignments</h2>
        {all.length > 4 && <Link to="/student/assignments" className="text-[13px] font-bold underline">View all</Link>}
      </div>
      <div className="mt-4">
        {orders.isLoading ? (
          <CardSkeletons count={2} />
        ) : all.length === 0 ? (
          <EmptyState icon={<FileText size={28} />} title="Post your first assignment" text="Tell us what you need, pay from your wallet and track it here until it is delivered."
            action={<Link to="/student/order" className="sp-btn"><Plus size={16} /> New Assignment</Link>} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">{all.slice(0, 4).map((o) => <AssignmentCard key={o.id} o={o} />)}</div>
        )}
      </div>
    </>
  );
}
