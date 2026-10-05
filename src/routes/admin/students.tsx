import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, Empty, Guard, PageHead, Pill } from "@/components/admin/AdminUI";
import { supabase } from "@/integrations/supabase/client";
import { UserDetailDialog } from "@/components/admin/UserDetailDialog";

export const Route = createFileRoute("/admin/students")({
  component: () => (
    <Guard area="students">
      <Students />
    </Guard>
  ),
});

function Students() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => String(r.role)),
      }));
    },
  });

  const toggleBan = useMutation({
    mutationFn: async ({ id, banned }: { id: string; banned: boolean }) => {
      const { error } = await supabase.from("profiles").update({ banned }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("User updated");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data.filter((u) =>
    `${u.full_name ?? ""} ${u.email ?? ""} ${u.school ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <>
      <PageHead title="User Management" subtitle="Students and account holders on the marketplace" />
      <Input
        className="mb-4 max-w-xs"
        placeholder="Search name, email or school"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <DataTable head={["Name", "Email", "School", "Roles", "Status", "Last seen", "Joined", "Action"]}>
        {rows.map((u) => (
          <tr key={u.id} className="cursor-pointer border-b last:border-0 hover:bg-muted/50" onClick={() => setOpenId(u.id)}>
            <td className="px-4 py-3 font-semibold">{u.full_name}</td>
            <td className="px-4 py-3">{u.email}</td>
            <td className="px-4 py-3">{u.school ?? "—"}</td>
            <td className="px-4 py-3">{u.roles.join(", ") || "student"}</td>
            <td className="px-4 py-3">
              <Pill tone={u.banned ? "bad" : "good"}>{u.banned ? "Banned" : "Active"}</Pill>
            </td>
            <td className="px-4 py-3 text-muted-foreground">
              {u.last_seen_at ? new Date(u.last_seen_at as string).toLocaleString() : "—"}
            </td>
            <td className="px-4 py-3 text-muted-foreground">
              {new Date(u.created_at as string).toLocaleDateString()}
            </td>
            <td className="px-4 py-3">
              <Button
                size="sm"
                variant={u.banned ? "outline" : "destructive"}
                onClick={(e) => { e.stopPropagation(); toggleBan.mutate({ id: u.id, banned: !u.banned }); }}
              >
                {u.banned ? "Unban" : "Ban"}
              </Button>
            </td>
          </tr>
        ))}
        {rows.length === 0 ? <Empty colSpan={8} label="No users found" /> : null}
      </DataTable>
      <UserDetailDialog userId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
