import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, BookOpen, FileText, HelpCircle, LayoutDashboard, LogOut, MessageSquare, Moon, Plus, Settings, Sun, Wallet, Contrast } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SpThemeProvider, SP_THEMES, useSpTheme, type SpTheme } from "@/lib/student-theme";
import { buildNotices, naira, timeAgo, useStudentData, useStudentRealtime, useStudentUser } from "@/lib/student-data";
import { Skeleton } from "@/components/student/ui";

const NAV = [
  { to: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/student/assignments", label: "My Assignments", icon: FileText },
  { to: "/student/wallet", label: "Wallet", icon: Wallet },
  { to: "/student/notifications", label: "Notifications", icon: Bell },
  { to: "/student/messages", label: "Messages", icon: MessageSquare },
  { to: "/student/settings", label: "Settings", icon: Settings },
  { to: "/student/support", label: "Help & Support", icon: HelpCircle },
] as const;

const TABS = [
  { to: "/student/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/student/assignments", label: "Orders", icon: FileText },
  { to: "/student/wallet", label: "Wallet", icon: Wallet },
  { to: "/student/messages", label: "Chat", icon: MessageSquare },
  { to: "/student/settings", label: "More", icon: Settings },
] as const;

const THEME_ICON: Record<SpTheme, typeof Sun> = { light: Sun, dark: Moon, contrast: Contrast };

export function Logo({ light }: { light?: boolean }) {
  return (
    <span className="text-[18px] font-extrabold tracking-tight" style={light ? { color: "#fff" } : undefined}>
      Uni<span style={{ color: "var(--sp-accent)" }}>everyhelp</span>
    </span>
  );
}

export function ThemeSwitch() {
  const { theme, setTheme } = useSpTheme();
  const next = SP_THEMES[(SP_THEMES.findIndex((t) => t.value === theme) + 1) % SP_THEMES.length]!;
  const Cur = THEME_ICON[theme];
  return (
    <>
      <div role="radiogroup" aria-label="Theme" className="hidden items-center gap-1 rounded-full p-1 md:flex" style={{ background: "var(--sp-surface-2)", border: "var(--sp-border-w) solid var(--sp-line)" }}>
        {SP_THEMES.map((t) => {
          const Icon = THEME_ICON[t.value];
          const on = theme === t.value;
          return (
            <button key={t.value} role="radio" aria-checked={on} aria-label={t.label} title={t.label} onClick={() => setTheme(t.value)}
              className="grid h-8 w-8 place-items-center rounded-full"
              style={{ background: on ? "var(--sp-accent)" : "transparent", color: on ? "var(--sp-accent-ink)" : "var(--sp-muted)" }}>
              <Icon size={16} />
            </button>
          );
        })}
      </div>
      <button className="grid h-10 w-10 place-items-center rounded-full md:hidden" aria-label={`Switch theme, now ${theme}. Next: ${next.label}`}
        onClick={() => setTheme(next.value)} style={{ background: "var(--sp-surface-2)", border: "var(--sp-border-w) solid var(--sp-line)" }}>
        <Cur size={18} />
      </button>
    </>
  );
}

function useNotices(uid: string | undefined, seenAt: string | undefined) {
  const { orders, txs, staffMessages } = useStudentData(uid);
  const notices = useMemo(() => buildNotices(orders.data ?? [], txs.data ?? [], staffMessages.data ?? []), [orders.data, txs.data, staffMessages.data]);
  const seen = seenAt ? new Date(seenAt).getTime() : 0;
  const unread = notices.filter((n) => new Date(n.time).getTime() > seen).length;
  return { notices, unread, seen };
}

export async function markNoticesRead(qc: ReturnType<typeof useQueryClient>) {
  await supabase.auth.updateUser({ data: { notifications_seen_at: new Date().toISOString() } });
  await qc.invalidateQueries({ queryKey: ["sp", "user"] });
}

function BellMenu({ uid, seenAt }: { uid: string | undefined; seenAt: string | undefined }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { notices, unread, seen } = useNotices(uid, seenAt);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} onClick={() => setOpen(!open)}
        className="relative grid h-10 w-10 place-items-center rounded-full" style={{ background: "var(--sp-surface-2)", border: "var(--sp-border-w) solid var(--sp-line)" }}>
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold" style={{ background: "var(--sp-accent)", color: "var(--sp-accent-ink)" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="sp-card fixed left-3 right-3 top-[68px] z-50 overflow-hidden md:absolute md:left-auto md:right-0 md:top-12 md:w-[340px]" style={{ boxShadow: "0 20px 50px rgba(0,0,0,.35)" }}>
          <div className="sp-line flex items-center justify-between border-b px-4 py-3">
            <span className="text-[14px] font-bold">Notifications</span>
            {unread > 0 && <button onClick={() => markNoticesRead(qc)} className="text-[12px] font-bold underline">Mark all read</button>}
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {notices.length === 0 && <p className="sp-muted px-4 py-8 text-center text-[13px]">No notifications yet.</p>}
            {notices.slice(0, 8).map((n) => (
              <button key={n.id} onClick={() => { setOpen(false); navigate({ to: n.to }); }} className="sp-line flex w-full gap-3 border-b px-4 py-3 text-left last:border-b-0">
                <span className="mt-[7px] h-2 w-2 flex-none rounded-full" style={{ background: new Date(n.time).getTime() > seen ? "var(--sp-accent)" : "var(--sp-line)" }} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium leading-5">{n.text}</span>
                  <span className="sp-muted text-[11px]">{timeAgo(n.time)}</span>
                </span>
              </button>
            ))}
          </div>
          <Link to="/student/notifications" onClick={() => setOpen(false)} className="sp-line block border-t py-3 text-center text-[13px] font-bold">View all</Link>
        </div>
      )}
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, ready } = useStudentUser();
  const uid = user?.id;
  const { profile, wallet } = useStudentData(uid);
  useStudentRealtime(uid);
  const seenAt = user?.user_metadata?.["notifications_seen_at"] as string | undefined;
  const { unread } = useNotices(uid, seenAt);

  useEffect(() => {
    if (ready && !user) navigate({ to: "/student/login", replace: true });
  }, [ready, user, navigate]);

  async function signOut() {
    await supabase.auth.signOut();
    localStorage.removeItem("uh_remember_until");
    qc.clear();
    navigate({ to: "/student/login", replace: true });
  }

  if (!ready || !user) {
    return (
      <div className="p-6" role="status" aria-label="Loading your portal">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="mt-6 h-32 w-full" />
        <Skeleton className="mt-4 h-24 w-full" />
      </div>
    );
  }

  const name = profile.data?.full_name || profile.data?.username || "Student";
  const active = (to: string) => path === to || path.startsWith(to + "/");

  return (
    <div className="min-h-screen">
      <aside className="sp-sidebar fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col p-5 md:flex">
        <Link to="/student/dashboard" className="mb-8 mt-1 px-2"><Logo light /></Link>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
              <Link key={n.to} to={n.to} className="sp-navlink" data-active={active(n.to)}>
                <Icon size={18} /> <span>{n.label}</span>
                {n.to === "/student/notifications" && unread > 0 && (
                  <span className="ml-auto rounded-full px-2 py-[1px] text-[11px] font-bold" style={{ background: "var(--sp-accent)", color: "var(--sp-accent-ink)" }}>{unread}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 rounded-2xl p-3" style={{ background: "rgba(255,255,255,.07)" }}>
          <div className="truncate text-[13px] font-bold text-white">{name}</div>
          <div className="text-[12px]" style={{ color: "rgba(255,255,255,.6)" }}>Balance {naira(wallet.data ?? 0)}</div>
          <button onClick={signOut} className="mt-2 flex items-center gap-2 text-[12px] font-semibold" style={{ color: "rgba(255,255,255,.75)" }}><LogOut size={14} /> Sign out</button>
        </div>
      </aside>

      <header className="sp-topbar fixed left-0 right-0 top-0 z-30 flex h-16 items-center justify-between gap-2 px-4 md:left-[260px] md:px-8">
        <Link to="/student/dashboard" className="md:hidden"><Logo /></Link>
        <span className="sp-muted hidden text-[14px] md:block">Welcome back, <b style={{ color: "var(--sp-ink)" }}>{name.split(" ")[0]}</b></span>
        <div className="flex items-center gap-2">
          <Link to="/student/order" className="sp-btn px-3 py-2 md:px-5" aria-label="New assignment"><Plus size={16} /><span className="hidden md:inline">New Assignment</span></Link>
          <ThemeSwitch />
          <BellMenu uid={uid} seenAt={seenAt} />
        </div>
      </header>

      <main className="px-4 pb-28 pt-24 md:ml-[260px] md:px-8 md:pb-12">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>

      <nav aria-label="Primary" className="sp-bottomnav fixed inset-x-0 bottom-0 z-30 flex md:hidden">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.to} to={t.to} className="sp-tab" data-active={active(t.to)}>
              <span className="sp-tab-icon"><Icon size={18} /></span>
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/** Signed-in pages: themed, guarded and wrapped with navigation. */
export function StudentShell({ children }: { children: ReactNode }) {
  return (
    <SpThemeProvider>
      <Frame>{children}</Frame>
    </SpThemeProvider>
  );
}

/** Sign-in and account recovery: themed but without navigation. */
export function StudentPublicFrame({ children }: { children: ReactNode }) {
  return (
    <SpThemeProvider>
      <div className="flex min-h-screen flex-col items-center px-4 py-6">
        <div className="flex w-full max-w-md items-center justify-between">
          <Logo />
          <ThemeSwitch />
        </div>
        <div className="mt-6 w-full max-w-md">{children}</div>
        <p className="sp-muted mt-8 flex items-center gap-2 text-[12px]"><BookOpen size={14} /> Assignment help for students</p>
      </div>
    </SpThemeProvider>
  );
}
