import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Super Admin Dashboard — Unieveryhelp" },
      {
        name: "description",
        content:
          "Unieveryhelp super admin dashboard: students, vendors, orders, assignments, wallets, disputes and sub-admins.",
      },
      { property: "og:title", content: "Super Admin Dashboard — Unieveryhelp" },
      { property: "og:description", content: "Internal Unieveryhelp control room." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminShell,
});

type NavItem = { to: string; label: string; area: string; exact?: boolean };

const NAV: NavItem[] = [
  { to: "/admin", label: "Dashboard", area: "dashboard", exact: true },
  { to: "/admin/students", label: "User Management", area: "students" },
  { to: "/admin/vendors", label: "Vendor Management", area: "vendors" },
  { to: "/admin/orders", label: "Order Management", area: "orders" },
  { to: "/admin/assignments", label: "Assignment Management", area: "assignments" },
  { to: "/admin/wallet", label: "Wallet & Revenue", area: "wallets" },
  { to: "/admin/chats", label: "Chat Management", area: "chats" },
  { to: "/admin/sub-admins", label: "Sub-Admin Management", area: "subadmins" },
  { to: "/admin/settings", label: "Settings", area: "settings" },
];

function AdminLogin({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onDone();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-sidebar px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-accent font-black text-accent-foreground">
            UH
          </span>
          <div>
            <h1 className="text-lg font-bold leading-tight">Unieveryhelp Admin</h1>
            <p className="text-xs text-muted-foreground">Staff access only</p>
          </div>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="admin-email">Email</Label>
            <Input
              id="admin-email"
              type="email"
              value={email}
              autoComplete="username"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-password">Password</Label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Card>
    </main>
  );
}

function NoAccess({ onClaimed }: { onClaimed: () => void }) {
  const [busy, setBusy] = useState(false);

  const claim = async (): Promise<void> => {
    setBusy(true);
    const { data, error } = await supabase.rpc("claim_super_admin" as never);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data === "granted") {
      toast.success("You are now the super admin.");
      onClaimed();
    } else if (data === "exists") {
      toast.error("A super admin already exists. Ask them for access.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-sidebar px-4">
      <Card className="w-full max-w-md space-y-4 p-8 text-center">
        <h1 className="text-xl font-bold">No admin access</h1>
        <p className="text-sm text-muted-foreground">
          This account is signed in but has no admin role. If you are the owner and no super admin
          exists yet, claim the super admin seat once.
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={claim} disabled={busy}>
            Claim super admin
          </Button>
          <Button variant="outline" onClick={() => supabase.auth.signOut()}>
            Sign out
          </Button>
        </div>
      </Card>
    </main>
  );
}

function AdminShell() {
  const { session, can, loading, refetch } = useAdminAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-sidebar text-sidebar-foreground">
        <p className="text-sm">Loading admin…</p>
      </main>
    );
  }
  if (!session) return <AdminLogin onDone={() => refetch()} />;
  if (!session.isAdmin) return <NoAccess onClaimed={() => refetch()} />;

  const items = NAV.filter((item) => can(item.area));
  const initials = session.fullName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-muted/40">
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-sidebar p-4 text-sidebar-foreground transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 px-2 pb-6 pt-2">
          <span className="grid size-9 place-items-center rounded-lg bg-sidebar-primary font-black text-sidebar-primary-foreground">
            UH
          </span>
          <span className="text-lg font-extrabold text-sidebar-accent-foreground">Unieveryhelp</span>
        </div>
        <p className="px-3 pb-2 text-[11px] uppercase tracking-widest text-sidebar-foreground/60">
          Workspace
        </p>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to as string}
                onClick={() => setOpen(false)}
                className={`block rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-[inset_3px_0_var(--sidebar-primary)]"
                    : "hover:bg-sidebar-accent/60"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 flex items-center gap-3 border-t border-sidebar-border pt-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sidebar-accent text-xs font-bold text-sidebar-accent-foreground">
            {initials || "AD"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-sidebar-accent-foreground">
              {session.fullName}
            </p>
            <p className="truncate text-[11px] text-sidebar-foreground/70">
              {session.isSuperAdmin ? "Super Admin" : "Sub-Admin"}
            </p>
          </div>
          <button
            aria-label="Sign out"
            onClick={() => supabase.auth.signOut()}
            className="ml-auto rounded-md px-2 py-1 text-sm hover:bg-sidebar-accent"
          >
            ↪
          </button>
        </div>
      </aside>

      {open ? (
        <div
          className="fixed inset-0 z-20 bg-foreground/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b bg-card px-4 lg:px-8">
          <button
            className="rounded-md border px-3 py-1.5 text-sm lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
          <h1 className="text-base font-bold sm:text-lg">
            {items.find((i) => (i.exact ? pathname === i.to : pathname.startsWith(i.to)))?.label ??
              "Admin"}
          </h1>
          <span className="ml-auto rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
            {session.isSuperAdmin ? "SUPER ADMIN" : "SUB-ADMIN"}
          </span>
        </header>
        <main className="mx-auto max-w-[1500px] p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
