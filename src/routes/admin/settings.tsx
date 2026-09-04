import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Guard, PageHead, Pill, Stat } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/settings")({
  component: () => (
    <Guard area="settings">
      <Settings />
    </Guard>
  ),
});

function Settings() {
  const { session, refetch } = useAdminAuth();
  const [fullName, setFullName] = useState(session?.fullName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(session?.avatarUrl ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: counts } = useQuery({
    queryKey: ["admin-settings-counts"],
    queryFn: async () => {
      const [profiles, vendors, orders, admins] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("vendors").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("id", { count: "exact", head: true }),
      ]);
      return {
        profiles: profiles.count ?? 0,
        vendors: vendors.count ?? 0,
        orders: orders.count ?? 0,
        admins: admins.count ?? 0,
      };
    },
  });

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, avatar_url: avatarUrl || null })
      .eq("id", session.userId);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile updated");
    refetch();
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPassword("");
    toast.success("Password changed");
  };

  return (
    <>
      <PageHead title="Settings" subtitle="Your admin account and platform overview" />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Users" value={counts?.profiles ?? 0} />
        <Stat label="Vendors" value={counts?.vendors ?? 0} />
        <Stat label="Orders" value={counts?.orders ?? 0} />
        <Stat label="Role assignments" value={counts?.admins ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="mb-1 text-sm font-bold">Admin profile</h3>
          <p className="mb-4 text-xs text-muted-foreground">
            {session?.email} ·{" "}
            <Pill tone={session?.isSuperAdmin ? "good" : "info"}>
              {session?.isSuperAdmin ? "Super Admin" : "Sub-Admin"}
            </Pill>
          </p>
          <form className="space-y-4" onSubmit={saveProfile}>
            <div className="space-y-1.5">
              <Label htmlFor="set-name">Full name</Label>
              <Input id="set-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-avatar">Avatar URL</Label>
              <Input
                id="set-avatar"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={busy}>
              Save profile
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <h3 className="mb-4 text-sm font-bold">Change password</h3>
          <form className="space-y-4" onSubmit={changePassword}>
            <div className="space-y-1.5">
              <Label htmlFor="set-pass">New password</Label>
              <Input
                id="set-pass"
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={busy}>
              Update password
            </Button>
          </form>
          <p className="mt-6 text-xs text-muted-foreground">
            Settings and Sub-Admin Management are restricted to the super admin at all times.
          </p>
        </Card>
      </div>
    </>
  );
}
