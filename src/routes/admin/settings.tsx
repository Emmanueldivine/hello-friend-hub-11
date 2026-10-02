import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
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
import { PasswordInput } from "@/routes/admin_.login";

export const Route = createFileRoute("/admin/settings")({
  component: () => (
    <Guard area="settings">
      <Settings />
    </Guard>
  ),
});

function Settings() {
  const { session, refetch } = useAdminAuth();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { reset?: string };
  const isReset = search.reset === "1";
  const [fullName, setFullName] = useState(session?.fullName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(session?.avatarUrl ?? "");
  const [email, setEmail] = useState(session?.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetUsername, setResetUsername] = useState("");
  const verifyUsername = useServerFn(verifyMyUsername);
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

  const changeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email });
    if (!error && session) {
      await supabase.from("profiles").update({ email }).eq("id", session.userId);
    }
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Email updated");
    refetch();
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (!isReset && !currentPassword) {
      toast.error("Enter your old password.");
      return;
    }
    setBusy(true);
    if (isReset) {
      const check = await verifyUsername({ data: { username: resetUsername } }).catch(() => ({ ok: false }));
      if (!check.ok) {
        setBusy(false);
        toast.error("Incorrect username.");
        return;
      }
    }
    const { error } = await supabase.auth.updateUser({
      password,
      ...(!isReset && currentPassword ? { current_password: currentPassword } : {}),
    } as Parameters<typeof supabase.auth.updateUser>[0]);
    setBusy(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("current") || msg.includes("invalid")) toast.error("Incorrect old password.");
      else if (msg.includes("different") || msg.includes("same")) toast.error("New password must be different from the old one.");
      else toast.error(error.message);
      return;
    }
    setPassword("");
    setConfirmPassword("");
    setCurrentPassword("");
    setResetUsername("");
    toast.success("Password changed");
    if (isReset) navigate({ to: "/admin/settings", search: {} as never, replace: true });
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
          <h3 className="mb-4 text-sm font-bold">Change email</h3>
          <form className="mb-8 space-y-4" onSubmit={changeEmail}>
            <div className="space-y-1.5">
              <Label htmlFor="set-email">Login email</Label>
              <Input
                id="set-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={busy}>
              Update email
            </Button>
          </form>

          <h3 className="mb-4 text-sm font-bold">Change password</h3>
          {isReset ? (
            <p className="mb-3 text-xs font-semibold text-destructive">Please set a new password now.</p>
          ) : null}
          <form className="space-y-4" onSubmit={changePassword}>
            {isReset ? (
              <div className="space-y-1.5">
                <Label htmlFor="set-username">Username</Label>
                <Input id="set-username" value={resetUsername} onChange={(e) => setResetUsername(e.target.value)} autoComplete="username" required />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="set-current">Old password</Label>
                <PasswordInput id="set-current" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="set-pass">New password</Label>
              <PasswordInput id="set-pass" minLength={8} autoComplete="new-password" value={password} onChange={setPassword} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-confirm">Confirm new password</Label>
              <PasswordInput id="set-confirm" minLength={8} autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} />
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
