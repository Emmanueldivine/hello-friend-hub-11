import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, FileText, MessageSquare, Wallet } from "lucide-react";
import { StudentShell, markNoticesRead } from "@/components/student/StudentShell";
import { EmptyState, PageTitle, Skeleton } from "@/components/student/ui";
import { buildNotices, timeAgo, useStudentData, useStudentUser } from "@/lib/student-data";

export const Route = createFileRoute("/student/notifications")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Notifications | Unieveryhelp" },
      { name: "description", content: "Updates about your assignments, wallet and messages." },
      { property: "og:title", content: "Notifications | Unieveryhelp" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <StudentShell>
      <Notifications />
    </StudentShell>
  ),
});

const ICON = { order: FileText, wallet: Wallet, message: MessageSquare } as const;

function Notifications() {
  const qc = useQueryClient();
  const { user } = useStudentUser();
  const { orders, txs, staffMessages } = useStudentData(user?.id);
  const loading = orders.isLoading || txs.isLoading;
  const notices = useMemo(() => buildNotices(orders.data ?? [], txs.data ?? [], staffMessages.data ?? []), [orders.data, txs.data, staffMessages.data]);
  const seen = user?.user_metadata?.["notifications_seen_at"] ? new Date(user.user_metadata["notifications_seen_at"] as string).getTime() : 0;
  const unread = notices.filter((n) => new Date(n.time).getTime() > seen).length;

  return (
    <>
      <PageTitle title="Notifications" sub={unread ? `${unread} unread` : "You are all caught up"}
        action={unread > 0 ? <button className="sp-btn sp-btn-ghost" onClick={() => markNoticesRead(qc)}>Mark all read</button> : undefined} />
      {loading ? (
        <div className="grid gap-3" role="status" aria-label="Loading">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[72px] w-full" />)}</div>
      ) : notices.length === 0 ? (
        <EmptyState icon={<Bell size={28} />} title="No notifications yet" text="Updates about your assignments, wallet and support messages will appear here." />
      ) : (
        <ul className="grid gap-3">
          {notices.map((n) => {
            const Icon = ICON[n.kind];
            const isNew = new Date(n.time).getTime() > seen;
            return (
              <li key={n.id}>
                <Link to={n.to} className="sp-card sp-card-link flex items-center gap-4 p-4">
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-full" style={{ background: isNew ? "var(--sp-accent)" : "var(--sp-surface-2)", color: isNew ? "var(--sp-accent-ink)" : "var(--sp-ink)" }}><Icon size={18} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium leading-5">{n.text}</span>
                    <span className="sp-muted text-[12px]">{timeAgo(n.time)}</span>
                  </span>
                  {isNew && <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: "var(--sp-accent)" }} aria-label="Unread" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
