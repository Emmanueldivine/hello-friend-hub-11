import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DataTable, Empty, Guard, PageHead, Pill, statusTone } from "@/components/admin/AdminUI";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/vendors")({
  component: () => (
    <Guard area="vendors">
      <Vendors />
    </Guard>
  ),
});

function Vendors() {
  const qc = useQueryClient();

  const { data = [] } = useQuery({
    queryKey: ["admin-vendors"],
    queryFn: async () => {
      const [{ data: vendors }, { data: profiles }] = await Promise.all([
        supabase.from("vendors").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name, email"),
      ]);
      return (vendors ?? []).map((v) => ({
        ...v,
        owner: (profiles ?? []).find((p) => p.id === v.user_id),
      }));
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("vendors")
        .update({ status: status as never })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vendor updated");
      qc.invalidateQueries({ queryKey: ["admin-vendors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHead title="Vendor Management" subtitle="Approve, suspend or review vendor accounts" />
      <DataTable head={["Business", "Owner", "Rating", "Status", "Joined", "Actions"]}>
        {data.map((v) => (
          <tr key={v.id} className="border-b last:border-0">
            <td className="px-4 py-3">
              <p className="font-semibold">{v.business_name}</p>
              <p className="text-xs text-muted-foreground">{v.bio}</p>
            </td>
            <td className="px-4 py-3">
              {v.owner?.full_name ?? "—"}
              <br />
              <span className="text-xs text-muted-foreground">{v.owner?.email}</span>
            </td>
            <td className="px-4 py-3">{Number(v.rating ?? 0).toFixed(1)}</td>
            <td className="px-4 py-3">
              <Pill tone={statusTone(String(v.status))}>{String(v.status)}</Pill>
            </td>
            <td className="px-4 py-3 text-muted-foreground">
              {new Date(v.created_at as string).toLocaleDateString()}
            </td>
            <td className="space-x-2 px-4 py-3">
              <Button size="sm" onClick={() => setStatus.mutate({ id: v.id, status: "approved" })}>
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setStatus.mutate({ id: v.id, status: "suspended" })}
              >
                Suspend
              </Button>
            </td>
          </tr>
        ))}
        {data.length === 0 ? <Empty colSpan={6} label="No vendors yet" /> : null}
      </DataTable>
    </>
  );
}
