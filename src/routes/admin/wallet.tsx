import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { DataTable, Empty, Guard, PageHead, Pill, Stat, statusTone } from "@/components/admin/AdminUI";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { naira } from "@/lib/admin-permissions";

export const Route = createFileRoute("/admin/wallet")({
  component: () => (
    <Guard area="wallets">
      <WalletRevenue />
    </Guard>
  ),
});

function WalletRevenue() {
  const { data } = useQuery({
    queryKey: ["admin-wallets"],
    queryFn: async () => {
      const [{ data: wallets }, { data: txns }, { data: orders }, { data: profiles }] =
        await Promise.all([
          supabase.from("wallets").select("*").order("balance", { ascending: false }),
          supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(100),
          supabase.from("orders").select("amount, commission, status, created_at"),
          supabase.from("profiles").select("id, full_name, email"),
        ]);
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return {
        wallets: (wallets ?? []).map((w) => ({ ...w, owner: byId.get(w.user_id) })),
        txns: (txns ?? []).map((t) => ({ ...t, owner: t.user_id ? byId.get(t.user_id) : undefined })),
        orders: orders ?? [],
      };
    },
  });

  const wallets = data?.wallets ?? [];
  const txns = data?.txns ?? [];
  const orders = data?.orders ?? [];

  const held = wallets.reduce((s, w) => s + Number(w.balance ?? 0), 0);
  const gross = orders.reduce((s, o) => s + Number(o.amount ?? 0), 0);
  const commission = orders.reduce((s, o) => s + Number(o.commission ?? 0), 0);
  const payouts = txns
    .filter((t) => t.type === "payout")
    .reduce((s, t) => s + Number(t.amount ?? 0), 0);

  const monthly = new Map<string, number>();
  for (const o of orders) {
    const key = new Date(o.created_at as string).toLocaleDateString("en-NG", {
      month: "short",
      year: "2-digit",
    });
    monthly.set(key, (monthly.get(key) ?? 0) + Number(o.commission ?? 0));
  }
  const months = [...monthly.entries()].slice(-6);
  const peak = Math.max(1, ...months.map(([, v]) => v));

  return (
    <>
      <PageHead title="Wallet & Revenue" subtitle="Platform earnings, balances and transactions" />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Gross order value" value={naira(gross)} />
        <Stat label="Platform commission" value={naira(commission)} hint="Total earned by Unieveryhelp" />
        <Stat label="Wallet balances held" value={naira(held)} hint={`${wallets.length} wallets`} />
        <Stat label="Payouts released" value={naira(payouts)} />
      </div>

      <Card className="mb-6 p-5">
        <h3 className="text-sm font-bold">Commission by month</h3>
        <div className="mt-5 flex h-40 items-end gap-4">
          {months.length === 0 ? (
            <p className="text-sm text-muted-foreground">No revenue recorded yet.</p>
          ) : (
            months.map(([label, value]) => (
              <div key={label} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-[11px] font-semibold">{naira(value)}</span>
                <div
                  className="w-full rounded-t-md bg-primary"
                  style={{ height: `${(value / peak) * 100}%`, minHeight: 4 }}
                />
                <span className="text-[11px] text-muted-foreground">{label}</span>
              </div>
            ))
          )}
        </div>
      </Card>

      <h3 className="mb-3 text-sm font-bold">Wallet balances</h3>
      <DataTable head={["User", "Email", "Currency", "Balance"]}>
        {wallets.map((w) => (
          <tr key={w.id} className="border-b last:border-0">
            <td className="px-4 py-3 font-semibold">{w.owner?.full_name ?? "—"}</td>
            <td className="px-4 py-3 text-muted-foreground">{w.owner?.email ?? "—"}</td>
            <td className="px-4 py-3">{w.currency}</td>
            <td className="px-4 py-3 font-semibold">{naira(w.balance)}</td>
          </tr>
        ))}
        {wallets.length === 0 ? <Empty colSpan={4} label="No wallets yet" /> : null}
      </DataTable>

      <h3 className="mb-3 mt-8 text-sm font-bold">Recent transactions</h3>
      <DataTable head={["Reference", "User", "Type", "Amount", "Status", "Date"]}>
        {txns.map((t) => (
          <tr key={t.id} className="border-b last:border-0">
            <td className="px-4 py-3 font-mono text-xs">{t.reference}</td>
            <td className="px-4 py-3">{t.owner?.full_name ?? "—"}</td>
            <td className="px-4 py-3 capitalize">{t.type}</td>
            <td className="px-4 py-3">{naira(t.amount)}</td>
            <td className="px-4 py-3">
              <Pill tone={t.status === "success" ? "good" : statusTone(String(t.status))}>
                {String(t.status)}
              </Pill>
            </td>
            <td className="px-4 py-3 text-muted-foreground">
              {new Date(t.created_at as string).toLocaleString()}
            </td>
          </tr>
        ))}
        {txns.length === 0 ? <Empty colSpan={6} label="No transactions yet" /> : null}
      </DataTable>
    </>
  );
}
