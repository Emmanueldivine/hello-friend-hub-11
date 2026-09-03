import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable, Empty, Guard, PageHead, Pill, Stat, statusTone } from "@/components/admin/AdminUI";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { naira } from "@/lib/admin-permissions";

export const Route = createFileRoute("/admin/orders")({
  component: () => (
    <Guard area="orders">
      <Orders />
    </Guard>
  ),
});

const STATUSES = ["pending", "in_progress", "under_review", "completed", "cancelled"] as const;

function Orders() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const { data = [] } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const [{ data: orders }, { data: profiles }, { data: vendors }] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name, email"),
        supabase.from("vendors").select("id, business_name"),
      ]);
      return (orders ?? []).map((o) => ({
        ...o,
        student: (profiles ?? []).find((p) => p.id === o.student_id),
        vendor: (vendors ?? []).find((v) => v.id === o.vendor_id),
      }));
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ status: status as never })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Order updated");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data.filter((o) => {
    const matchesStatus = filter === "all" || o.status === filter;
    const term = search.trim().toLowerCase();
    const matchesTerm =
      !term ||
      [o.reference, o.title, o.student?.full_name, o.vendor?.business_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    return matchesStatus && matchesTerm;
  });

  const revenue = data
    .filter((o) => o.status === "completed")
    .reduce((sum, o) => sum + Number(o.amount ?? 0), 0);

  return (
    <>
      <PageHead title="Order Management" subtitle="Track every order placed on the marketplace" />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total orders" value={data.length} />
        <Stat label="Pending" value={data.filter((o) => o.status === "pending").length} />
        <Stat label="In progress" value={data.filter((o) => o.status === "in_progress").length} />
        <Stat label="Completed value" value={naira(revenue)} />
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          className="max-w-xs"
          placeholder="Search reference, title, student…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable head={["Reference", "Order", "Student", "Vendor", "Amount", "Commission", "Status", "Date"]}>
        {rows.map((o) => (
          <tr key={o.id} className="border-b last:border-0">
            <td className="px-4 py-3 font-mono text-xs">{o.reference}</td>
            <td className="px-4 py-3 font-semibold">{o.title}</td>
            <td className="px-4 py-3">{o.student?.full_name ?? "—"}</td>
            <td className="px-4 py-3">{o.vendor?.business_name ?? "—"}</td>
            <td className="px-4 py-3">{naira(o.amount)}</td>
            <td className="px-4 py-3 text-muted-foreground">{naira(o.commission)}</td>
            <td className="px-4 py-3">
              <Select
                value={String(o.status)}
                onValueChange={(status) => setStatus.mutate({ id: o.id, status })}
              >
                <SelectTrigger className="h-8 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </td>
            <td className="px-4 py-3 text-muted-foreground">
              {new Date(o.created_at as string).toLocaleDateString()}
            </td>
          </tr>
        ))}
        {rows.length === 0 ? <Empty colSpan={8} label="No orders match this view" /> : null}
      </DataTable>

      <p className="mt-3 text-xs text-muted-foreground">
        Status legend:{" "}
        {STATUSES.map((s) => (
          <span key={s} className="mr-2 inline-block">
            <Pill tone={statusTone(s)}>{s.replace("_", " ")}</Pill>
          </span>
        ))}
      </p>
    </>
  );
}
