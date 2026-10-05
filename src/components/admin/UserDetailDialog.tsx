import { useQuery } from "@tanstack/react-query";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pill, statusTone } from "@/components/admin/AdminUI";
import { supabase } from "@/integrations/supabase/client";
import { naira } from "@/lib/admin-permissions";

export function UserDetailDialog({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-user-detail", userId],
    enabled: !!userId,
    queryFn: async () => {
      const id = userId as string;
      const [p, w, o, t] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("wallets").select("balance").eq("user_id", id).maybeSingle(),
        supabase.from("orders").select("id, reference, title, amount, status, created_at").eq("student_id", id).order("created_at", { ascending: false }),
        supabase.from("transactions").select("id, amount, type, status, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(10),
      ]);
      return { profile: p.data, balance: Number(w.data?.balance ?? 0), orders: o.data ?? [], tx: t.data ?? [] };
    },
  });

  const p = data?.profile;
  const pending = (data?.orders ?? []).filter((o) => o.status !== "completed" && o.status !== "cancelled").length;

  return (
    <Dialog open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>User details</DialogTitle>
        </DialogHeader>
        {isLoading || !data ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !p ? (
          <p className="text-sm text-muted-foreground">User not found.</p>
        ) : (
          <div className="space-y-5 text-sm">
            <div className="flex items-center gap-4">
              {p.avatar_url ? (
                <img src={p.avatar_url} alt={p.full_name} className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                  {p.full_name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-base font-bold">{p.full_name}</p>
                {p.username ? <p className="text-muted-foreground">@{p.username}</p> : null}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <Item label="Phone" value={p.phone ?? "—"} />
              <Item label="Email" value={p.email ?? "—"} />
              <Item label="School" value={p.school ?? "—"} />
              <Item label="Department" value={p.department ?? "—"} />
              <Item label="Date joined" value={new Date(p.created_at).toLocaleDateString()} />
              <Item label="Wallet balance" value={naira(data.balance)} />
              <Item label="Total assignments" value={String(data.orders.length)} />
              <Item label="Pending assignments" value={String(pending)} />
            </dl>
            <div>
              <h4 className="mb-2 font-bold">Assignments</h4>
              {data.orders.length === 0 ? <p className="text-muted-foreground">None yet</p> : (
                <ul className="divide-y rounded-md border">
                  {data.orders.slice(0, 8).map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="truncate">{o.title}</span>
                      <Pill tone={statusTone(String(o.status))}>{String(o.status).replace("_", " ")}</Pill>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4 className="mb-2 font-bold">Recent transactions</h4>
              {data.tx.length === 0 ? <p className="text-muted-foreground">None yet</p> : (
                <ul className="divide-y rounded-md border">
                  {data.tx.map((t) => (
                    <li key={t.id} className="flex items-center justify-between px-3 py-2">
                      <span className="capitalize">{t.type} · {new Date(t.created_at).toLocaleDateString()}</span>
                      <span className="font-semibold">{naira(t.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="break-all font-semibold">{value}</dd>
    </div>
  );
}
