import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable, Empty, Guard, PageHead, Pill } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_PERMISSIONS } from "@/lib/admin-permissions";
import { createSubAdmin, deleteSubAdmin, updateSubAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/sub-admins")({
  component: () => (
    <Guard area="subadmins">
      <SubAdmins />
    </Guard>
  ),
});

function SubAdmins() {
  const qc = useQueryClient();
  const create = useServerFn(createSubAdmin);
  const update = useServerFn(updateSubAdmin);
  const remove = useServerFn(deleteSubAdmin);

  const [form, setForm] = useState({ fullName: "", email: "", password: "", avatarUrl: "" });
  const [perms, setPerms] = useState<string[]>([]);

  const { data = [] } = useQuery({
    queryKey: ["admin-subadmins"],
    queryFn: async () => {
      const [{ data: roles }, { data: profiles }, { data: permissions }] = await Promise.all([
        supabase.from("user_roles").select("user_id, role, created_at"),
        supabase.from("profiles").select("id, full_name, email, avatar_url"),
        supabase.from("admin_permissions").select("admin_id, permission"),
      ]);
      const admins = (roles ?? []).filter((r) => r.role === "admin" || r.role === "super_admin");
      return admins.map((r) => ({
        userId: r.user_id,
        role: r.role as string,
        createdAt: r.created_at as string,
        profile: (profiles ?? []).find((p) => p.id === r.user_id),
        permissions: (permissions ?? [])
          .filter((p) => p.admin_id === r.user_id)
          .map((p) => p.permission as string),
      }));
    },
  });

  const createMut = useMutation({
    mutationFn: async () => create({ data: { ...form, permissions: perms } }),
    onSuccess: () => {
      toast.success("Sub-admin created");
      setForm({ fullName: "", email: "", password: "", avatarUrl: "" });
      setPerms([]);
      qc.invalidateQueries({ queryKey: ["admin-subadmins"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async (v: { adminId: string; permissions: string[] }) => update({ data: v }),
    onSuccess: () => {
      toast.success("Permissions saved");
      qc.invalidateQueries({ queryKey: ["admin-subadmins"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (adminId: string) => remove({ data: { adminId } }),
    onSuccess: () => {
      toast.success("Sub-admin removed");
      qc.invalidateQueries({ queryKey: ["admin-subadmins"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePerm = (key: string) =>
    setPerms((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]));

  return (
    <>
      <PageHead
        title="Sub-Admin Management"
        subtitle="Only the super admin can create sub-admins and choose the pages they may open"
      />

      <Card className="mb-8 p-6">
        <h3 className="mb-4 text-sm font-bold">Create a sub-admin</h3>
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            createMut.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="sa-name">Full name</Label>
            <Input
              id="sa-name"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sa-email">Email</Label>
            <Input
              id="sa-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sa-pass">Temporary password</Label>
            <Input
              id="sa-pass"
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sa-avatar">Avatar URL (optional)</Label>
            <Input
              id="sa-avatar"
              value={form.avatarUrl}
              onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
            />
          </div>

          <div className="md:col-span-2">
            <p className="mb-2 text-sm font-semibold">Pages this sub-admin can open</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ADMIN_PERMISSIONS.map((p) => (
                <label key={p.key} className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                  <Checkbox
                    checked={perms.includes(p.key)}
                    onCheckedChange={() => togglePerm(p.key)}
                  />
                  {p.label}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Sub-admins never get Wallet & Revenue settings or Sub-Admin Management unless you tick
              them here — Sub-Admin Management and Settings stay super-admin only.
            </p>
          </div>

          <div className="md:col-span-2">
            <Button type="submit" disabled={createMut.isPending}>
              {createMut.isPending ? "Creating…" : "Create sub-admin"}
            </Button>
          </div>
        </form>
      </Card>

      <DataTable head={["Admin", "Email", "Role", "Permissions", "Actions"]}>
        {data.map((a) => (
          <tr key={a.userId} className="border-b align-top last:border-0">
            <td className="px-4 py-3 font-semibold">{a.profile?.full_name ?? "—"}</td>
            <td className="px-4 py-3 text-muted-foreground">{a.profile?.email ?? "—"}</td>
            <td className="px-4 py-3">
              <Pill tone={a.role === "super_admin" ? "good" : "info"}>
                {a.role === "super_admin" ? "Super Admin" : "Sub-Admin"}
              </Pill>
            </td>
            <td className="px-4 py-3">
              {a.role === "super_admin" ? (
                <span className="text-xs text-muted-foreground">Full access</span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {ADMIN_PERMISSIONS.map((p) => {
                    const on = a.permissions.includes(p.key);
                    return (
                      <button
                        key={p.key}
                        onClick={() =>
                          updateMut.mutate({
                            adminId: a.userId,
                            permissions: on
                              ? a.permissions.filter((x) => x !== p.key)
                              : [...a.permissions, p.key],
                          })
                        }
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          on ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </td>
            <td className="px-4 py-3">
              {a.role === "super_admin" ? (
                <span className="text-xs text-muted-foreground">—</span>
              ) : (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteMut.mutate(a.userId)}
                  disabled={deleteMut.isPending}
                >
                  Remove
                </Button>
              )}
            </td>
          </tr>
        ))}
        {data.length === 0 ? <Empty colSpan={5} label="No admins yet" /> : null}
      </DataTable>
    </>
  );
}
