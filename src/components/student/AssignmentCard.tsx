import { Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { naira, STATUS_META, type Order } from "@/lib/student-data";
import { StatusChip } from "@/components/student/ui";
import { shortRef } from "@/lib/utils";

const barColor = (o: Order) => (o.status === "completed" ? "var(--sp-ok)" : o.status === "under_review" ? "var(--sp-info)" : "var(--sp-accent)");

export function AssignmentCard({ o }: { o: Order }) {
  const pct = o.status === "completed" ? 100 : o.status === "cancelled" ? 0 : Math.min(o.progress, 90);
  return (
    <Link to="/student/assignment/$id" params={{ id: o.id }} className="sp-card sp-card-link p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-bold">{o.title}</div>
          <div className="sp-muted mt-1 text-[12px]">{o.course_code || "No course"} · {shortRef(o.reference)}</div>
        </div>
        <StatusChip status={o.status} />
      </div>
      <div className="sp-track mt-4" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${STATUS_META[o.status].label} ${pct}%`}>
        <div className="sp-bar" style={{ width: `${pct}%`, background: barColor(o) }} />
      </div>
      <div className="sp-muted mt-3 flex items-center justify-between text-[12px]">
        <span className="flex items-center gap-1"><Clock size={13} />{o.deadline ? new Date(o.deadline).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "No deadline"}</span>
        <b style={{ color: "var(--sp-ink)" }}>{naira(o.amount)}</b>
      </div>
    </Link>
  );
}
