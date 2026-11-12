import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { FileText, Plus } from "lucide-react";
import { StudentShell } from "@/components/student/StudentShell";
import { AssignmentCard } from "@/components/student/AssignmentCard";
import { CardSkeletons, EmptyState, PageTitle } from "@/components/student/ui";
import { useStudentData, useStudentUser, type OrderStatus } from "@/lib/student-data";

export const Route = createFileRoute("/student/assignments")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My Assignments | Unieveryhelp" },
      { name: "description", content: "Track and manage all your assignments." },
      { property: "og:title", content: "My Assignments | Unieveryhelp" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <StudentShell>
      <Assignments />
    </StudentShell>
  ),
});

const FILTERS: { value: "all" | OrderStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Received" },
  { value: "in_progress", label: "In Progress" },
  { value: "under_review", label: "Under Review" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function Assignments() {
  const { user } = useStudentUser();
  const { orders } = useStudentData(user?.id);
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const all = orders.data ?? [];
  const shown = filter === "all" ? all : all.filter((o) => o.status === filter);

  return (
    <>
      <PageTitle title="My Assignments" sub="Track and manage your assignments" action={<Link to="/student/order" className="sp-btn"><Plus size={16} /> New Assignment</Link>} />
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => {
          const on = filter === f.value;
          const count = f.value === "all" ? all.length : all.filter((o) => o.status === f.value).length;
          return (
            <button key={f.value} role="tab" aria-selected={on} onClick={() => setFilter(f.value)} className="flex-none rounded-full px-4 py-2 text-[13px] font-bold"
              style={{ background: on ? "var(--sp-accent)" : "var(--sp-surface)", color: on ? "var(--sp-accent-ink)" : "var(--sp-ink)", border: "var(--sp-border-w) solid " + (on ? "var(--sp-accent)" : "var(--sp-line)") }}>
              {f.label} <span className="opacity-70">{count}</span>
            </button>
          );
        })}
      </div>
      {orders.isLoading ? (
        <CardSkeletons count={4} />
      ) : shown.length === 0 ? (
        <EmptyState icon={<FileText size={28} />} title={all.length ? "Nothing here" : "No assignments yet"}
          text={all.length ? "No assignments match this filter." : "Click New Assignment to create your first order."}
          action={!all.length ? <Link to="/student/order" className="sp-btn"><Plus size={16} /> New Assignment</Link> : undefined} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">{shown.map((o) => <AssignmentCard key={o.id} o={o} />)}</div>
      )}
    </>
  );
}
