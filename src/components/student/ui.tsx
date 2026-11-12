import type { ReactNode } from "react";
import { STATUS_META, type OrderStatus } from "@/lib/student-data";

export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden className={`sp-skel ${className}`} style={style} />;
}

export function CardSkeletons({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2" role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="sp-card p-5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-3 h-3 w-1/3" />
          <Skeleton className="mt-6 h-2.5 w-full" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="sp-card flex flex-col items-center px-6 py-14 text-center" style={{ borderStyle: "dashed" }}>
      <div className="grid h-16 w-16 place-items-center rounded-full" style={{ background: "var(--sp-accent-soft)", color: "var(--sp-ink)" }}>{icon}</div>
      <h3 className="mt-5 text-[17px] font-bold">{title}</h3>
      <p className="sp-muted mt-1 max-w-sm text-[14px]">{text}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function StatusChip({ status }: { status: OrderStatus }) {
  const m = STATUS_META[status];
  return <span className={`sp-chip ${m.chip}`}>{m.label}</span>;
}

export function PageTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[24px] font-extrabold tracking-tight md:text-[28px]">{title}</h1>
        {sub && <p className="sp-muted mt-1 text-[14px]">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/** Step tracker: Received, In Progress, Under Review, Completed. */
export function StatusTracker({ status }: { status: OrderStatus }) {
  if (status === "cancelled") return <StatusChip status="cancelled" />;
  const step = STATUS_META[status].step;
  const labels = ["Received", "In Progress", "Under Review", "Completed"];
  return (
    <ol className="flex items-start" aria-label="Assignment progress">
      {labels.map((l, i) => {
        const done = i <= step;
        return (
          <li key={l} className="flex flex-1 flex-col items-center text-center" aria-current={i === step ? "step" : undefined}>
            <div className="flex w-full items-center">
              <span className="h-[3px] flex-1" style={{ background: i === 0 ? "transparent" : done ? "var(--sp-accent)" : "var(--sp-line)" }} />
              <span
                className="grid h-7 w-7 flex-none place-items-center rounded-full text-[11px] font-extrabold"
                style={{ background: done ? "var(--sp-accent)" : "var(--sp-surface-2)", color: done ? "var(--sp-accent-ink)" : "var(--sp-muted)", border: "var(--sp-border-w) solid " + (done ? "var(--sp-accent)" : "var(--sp-line)") }}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className="h-[3px] flex-1" style={{ background: i === labels.length - 1 ? "transparent" : i < step ? "var(--sp-accent)" : "var(--sp-line)" }} />
            </div>
            <span className="mt-2 text-[10.5px] font-semibold leading-tight md:text-[12px]" style={{ color: done ? "var(--sp-ink)" : "var(--sp-muted)" }}>{l}</span>
          </li>
        );
      })}
    </ol>
  );
}
