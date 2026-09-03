import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable, Empty, Guard, PageHead, Pill, Stat } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { naira } from "@/lib/admin-permissions";

export const Route = createFileRoute("/admin/assignments")({
  component: () => (
    <Guard area="assignments">
      <Assignments />
    </Guard>
  ),
});

function Assignments() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data = [] } = useQuery({
    queryKey: ["admin-assignments"],
    queryFn: async () => {
      const [{ data: assignments }, { data: vendors }] = await Promise.all([
        supabase.from("assignments").select("*").order("created_at", { ascending: false }),
        supabase.from("vendors").select("id, business_name"),
      ]);
      return (assignments ?? []).map((a) => ({
        ...a,
        vendor: (vendors ?? []).find((v) => v.id === a.vendor_id),
      }));
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from("assignments").update({ is_active: isActive }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assignment updated");
      qc.invalidateQueries({ queryKey: ["admin-assignments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assignment deleted");
      qc.invalidateQueries({ queryKey: ["admin-assignments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const term = search.trim().toLowerCase();
  const rows = data.filter(
    (a) =>
      !term ||
      [a.title, a.category, a.course_code, a.vendor?.business_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
  );

  return (
    <>
      <PageHead
        title="Assignment Management"
        subtitle="Every assignment service listed by vendors"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Total assignments" value={data.length} />
        <Stat label="Active" value={data.filter((a) => a.is_active).length} />
        <Stat
          label="Average price"
          value={naira(
            data.length ? data.reduce((s, a) => s + Number(a.price ?? 0), 0) / data.length : 0,
          )}
        />
      </div>

      <Input
        className="mb-4 max-w-xs"
        placeholder="Search title, course, vendor…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <DataTable head={["Assignment", "Vendor", "Category", "Course", "Price", "Status", "Actions"]}>
        {rows.map((a) => (
          <tr key={a.id} className="border-b last:border-0">
            <td className="px-4 py-3">
              <p className="font-semibold">{a.title}</p>
              <p className="max-w-xs truncate text-xs text-muted-foreground">{a.description}</p>
            </td>
            <td className="px-4 py-3">{a.vendor?.business_name ?? "—"}</td>
            <td className="px-4 py-3">{a.category ?? "—"}</td>
            <td className="px-4 py-3 font-mono text-xs">{a.course_code ?? "—"}</td>
            <td className="px-4 py-3">{naira(a.price)}</td>
            <td className="px-4 py-3">
              <Pill tone={a.is_active ? "good" : "muted"}>{a.is_active ? "active" : "hidden"}</Pill>
            </td>
            <td className="space-x-2 whitespace-nowrap px-4 py-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => toggle.mutate({ id: a.id, isActive: !a.is_active })}
              >
                {a.is_active ? "Hide" : "Publish"}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => remove.mutate(a.id)}>
                Delete
              </Button>
            </td>
          </tr>
        ))}
        {rows.length === 0 ? <Empty colSpan={7} label="No assignments yet" /> : null}
      </DataTable>
    </>
  );
}
