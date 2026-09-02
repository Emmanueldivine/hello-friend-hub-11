import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Card } from "@/components/ui/card";
import { DataTable, Empty, PageHead, Pill, Stat, statusTone } from "@/components/admin/AdminUI";
import { supabase } from "@/integrations/supabase/client";
import { naira } from "@/lib/admin-permissions";

export const Route = createFileRoute("/admin/")({ component: Dashboard });

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const [profiles, vendors, orders, assignments, transactions, chats] = await Promise.all([
        supabase.from("profiles").select("id, created_at"),
        supabase.from("vendors").select("id, status"),
        supabase
          .from("orders")
          .select("id, reference, title, amount, commission, status, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("assignments").select("id, is_active"),
        supabase.from("transactions").select("amount, status, type"),
        supabase.from("chats").select("id, is_dispute, status"),
      ]);
      return {
        profiles: profiles.data ?? [],
        vendors: vendors.data ?? [],
        orders: orders.data ?? [],
        assignments: assignments.data ?? [],
        transactions: transactions.data ?? [],
        chats: chats.data ?? [],
      };
    },
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading metrics…</p>;

  const revenue = data.orders.reduce((sum, o) => sum + Number(o.amount ?? 0), 0);
  const commission = data.orders.reduce((sum, o) => sum + Number(o.commission ?? 0), 0);
  const disputes = data.chats.filter((c) => c.is_dispute).length;

  const byDay = new Map<string, number>();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }
  data.orders.forEach((o) => {
    const key = String(o.created_at).slice(0, 10);
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
  });
  const chart = [...byDay.entries()];
  const peak = Math.max(1, ...chart.map(([, v]) => v));

  return (
    <>
      <PageHead title="Overview" subtitle="Live marketplace activity across Unieveryhelp" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Stat label="Users" value={data.profiles.length} />
        <Stat label="Vendors" value={data.vendors.length} hint={`${data.vendors.filter((v) => v.status === "approved").length} approved`} />
        <Stat label="Assignments" value={data.assignments.length} />
        <Stat label="Orders" value={data.orders.length} />
        <Stat label="Volume" value={naira(revenue)} />
        <Stat label="Commission" value={naira(commission)} hint={`${disputes} open disputes`} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-bold">Orders — last 7 days</h3>
          <div className="flex h-52 items-end gap-3">
            {chart.map(([day, count]) => (
              <div key={day} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-md bg-primary/70"
                  style={{ height: `${Math.max(6, (count / peak) * 100)}%` }}
                  title={`${count} orders`}
                />
                <span className="text-[10px] text-muted-foreground">
                  {new Date(day).toLocaleDateString("en-NG", { weekday: "short" })}
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-bold">Order status split</h3>
          <div className="space-y-3">
            {["pending", "accepted", "in_progress", "completed", "disputed", "cancelled"].map((s) => {
              const count = data.orders.filter((o) => o.status === s).length;
              return (
                <div key={s} className="flex items-center gap-3">
                  <span className="w-28 text-xs capitalize text-muted-foreground">
                    {s.replace("_", " ")}
                  </span>
                  <div className="h-2 flex-1 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-accent"
                      style={{ width: `${(count / Math.max(1, data.orders.length)) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-xs font-bold">{count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <h3 className="mb-3 text-sm font-bold">Latest orders</h3>
        <DataTable head={["Reference", "Assignment", "Amount", "Status", "Created"]}>
          {data.orders.slice(0, 8).map((o) => (
            <tr key={o.id} className="border-b last:border-0">
              <td className="px-4 py-3 font-semibold">{o.reference}</td>
              <td className="px-4 py-3">{o.title}</td>
              <td className="px-4 py-3">{naira(o.amount)}</td>
              <td className="px-4 py-3">
                <Pill tone={statusTone(String(o.status))}>{String(o.status).replace("_", " ")}</Pill>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(o.created_at as string).toLocaleDateString()}
              </td>
            </tr>
          ))}
          {data.orders.length === 0 ? <Empty colSpan={5} label="No orders yet" /> : null}
        </DataTable>
      </div>
    </>
  );
}
