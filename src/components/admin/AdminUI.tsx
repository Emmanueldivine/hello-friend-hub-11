import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { useAdminAuth } from "@/hooks/useAdminAuth";

export function Guard({ area, children }: { area: string; children: ReactNode }) {
  const { can, loading } = useAdminAuth();
  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!can(area)) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-lg font-bold">Access restricted</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your admin account does not have permission for this page.
        </p>
      </Card>
    );
  }
  return <>{children}</>;
}

export function PageHead({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="gap-0 p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-3 text-2xl font-extrabold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

export function DataTable({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                className="whitespace-nowrap border-b px-4 py-3 text-left text-[11px] uppercase tracking-wide text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </Card>
  );
}

export function Empty({ colSpan, label = "Nothing here yet" }: { colSpan: number; label?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-muted-foreground">
        {label}
      </td>
    </tr>
  );
}

export function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "good" | "warn" | "bad" | "info" }) {
  const tones: Record<string, string> = {
    muted: "bg-muted text-muted-foreground",
    good: "bg-accent/25 text-accent-foreground",
    warn: "bg-accent text-accent-foreground",
    bad: "bg-destructive/15 text-destructive",
    info: "bg-primary/10 text-primary",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function statusTone(status: string): "muted" | "good" | "warn" | "bad" | "info" {
  switch (status) {
    case "completed":
    case "approved":
    case "delivered":
      return "good";
    case "in_progress":
    case "accepted":
      return "info";
    case "pending":
      return "warn";
    case "cancelled":
    case "disputed":
    case "suspended":
    case "rejected":
      return "bad";
    default:
      return "muted";
  }
}
