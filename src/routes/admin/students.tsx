import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, Empty, Guard, PageHead, Pill } from "@/components/admin/AdminUI";
import { supabase } from "@/integrations/supabase/client";
import { UserDetailDialog } from "@/components/admin/UserDetailDialog";
import { getSchoolGroupKey, getSchoolGroupLabel } from "@/lib/school-normalization";

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
  const [school, setSchool] = useState<string | null>(null);
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

  const students = data.filter((u) => !u.roles.some((r) => r === "super_admin" || r === "admin" || r === "vendor"));
  const schoolCounts = Object.entries(
    students.reduce<Record<string, number>>((acc, u) => {
      const name = (u.school ?? "").trim();
      const key = name ? getSchoolGroupKey(name) : "not-set";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([key, count]) => {
      const matchingSchool = students.find((u) => {
        const name = (u.school ?? "").trim();
        return name && getSchoolGroupKey(name) === key;
      })?.school;
      return [key, matchingSchool ? getSchoolGroupLabel(matchingSchool) : "Not set", count] as const;
    })
    .sort((a, b) => b[2] - a[2]);
  const rows = students.filter(
    (u) =>
      (!school || ((u.school ?? "").trim() ? getSchoolGroupKey(u.school ?? "") : "not-set") === school) &&
      `${u.full_name ?? ""} ${u.email ?? ""} ${u.phone ?? ""} ${u.school ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <>
      <PageHead title="User Management" subtitle="Students and account holders on the marketplace" />
      <div className="mb-4 rounded-xl border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">Students by university · {students.length} total</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={school === null ? "default" : "outline"} onClick={() => setSchool(null)}>
            All ({students.length})
          </Button>
          {schoolCounts.map(([key, name, count]) => (
            <Button key={key} size="sm" variant={school === key ? "default" : "outline"} onClick={() => setSchool(key)}>
              {name} ({count})
            </Button>
          ))}
        </div>
      </div>
      <Input
        className="mb-4 max-w-xs"
        placeholder="Search name, email or school"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <DataTable head={["Name", "Email", "Phone", "School", "Roles", "Status", "Last seen", "Joined", "Action"]}>
        {rows.map((u) => (
          <tr key={u.id} className="cursor-pointer border-b last:border-0 hover:bg-muted/50" onClick={() => setOpenId(u.id)}>
            <td className="px-4 py-3 font-semibold">{u.full_name}</td>
            <td className="px-4 py-3">{u.email}</td>
            <td className="px-4 py-3">{u.phone ?? "—"}</td>
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
        {rows.length === 0 ? <Empty colSpan={9} label="No users found" /> : null}
      </DataTable>
      <UserDetailDialog userId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
