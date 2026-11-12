import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Contrast, LogOut, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StudentShell } from "@/components/student/StudentShell";
import { PageTitle, Skeleton } from "@/components/student/ui";
import { useStudentData, useStudentUser } from "@/lib/student-data";
import { SP_THEMES, useSpTheme } from "@/lib/student-theme";

export const Route = createFileRoute("/student/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Settings | Unieveryhelp" },
      { name: "description", content: "Your profile and appearance settings." },
      { property: "og:title", content: "Settings | Unieveryhelp" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <StudentShell>
      <Settings />
    </StudentShell>
  ),
});

const PREVIEW = {
  light: { icon: Sun, bg: "#f8fafc", fg: "#0a1931", acc: "#ffd700", note: "Clean and bright" },
  dark: { icon: Moon, bg: "#0b0f1a", fg: "#eaf0ff", acc: "#ffc93c", note: "Deep ink with gold" },
  contrast: { icon: Contrast, bg: "#000000", fg: "#ffffff", acc: "#ffeb3b", note: "Maximum readability" },
} as const;

function Settings() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useStudentUser();
  const { profile } = useStudentData(user?.id);
  const { theme, setTheme } = useSpTheme();
  const [form, setForm] = useState({ school: "", department: "", level: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile.data) setForm({ school: profile.data.school ?? "", department: profile.data.department ?? "", level: profile.data.level ?? "" });
  }, [profile.data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ school: form.school.trim(), department: form.department.trim(), level: form.level.trim() }).eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error("Unable to save your details. Please try again.");
      return;
    }
    toast.success("Your details were saved.");
    qc.invalidateQueries({ queryKey: ["sp", "profile"] });
  }

  async function signOut() {
    await supabase.auth.signOut();
    localStorage.removeItem("uh_remember_until");
    qc.clear();
    navigate({ to: "/student/login", replace: true });
  }

  const p = profile.data;
  const info = (k: string, v: string | null | undefined) => (
    <div className="sp-line flex justify-between gap-4 border-t py-3 text-[14px] first:border-t-0"><span className="sp-muted">{k}</span><span className="font-semibold">{v || "-"}</span></div>
  );

  return (
    <>
      <PageTitle title="Settings" sub="Your profile and how the portal looks." />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="sp-card p-5" aria-labelledby="profile-h">
          <h2 id="profile-h" className="text-[16px] font-bold">Profile</h2>
          {profile.isLoading ? <Skeleton className="mt-4 h-32 w-full" /> : (
            <div className="mt-2">
              {info("Full name", p?.full_name)}
              {info("Username", p?.username)}
              {info("Phone", p?.phone)}
              {info("Email", p?.real_email)}
            </div>
          )}
        </section>

        <form onSubmit={save} className="sp-card grid gap-4 p-5">
          <h2 className="text-[16px] font-bold">Academic details</h2>
          <div><label className="sp-label" htmlFor="school">School</label><input id="school" className="sp-field" value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} maxLength={120} /></div>
          <div><label className="sp-label" htmlFor="dept">Department</label><input id="dept" className="sp-field" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} maxLength={120} /></div>
          <div><label className="sp-label" htmlFor="level">Level</label><input id="level" className="sp-field" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} maxLength={20} /></div>
          <button className="sp-btn" disabled={busy}>{busy ? "Saving…" : "Save details"}</button>
        </form>

        <section className="sp-card p-5 lg:col-span-2" aria-labelledby="theme-h">
          <h2 id="theme-h" className="text-[16px] font-bold">Appearance</h2>
          <p className="sp-muted mt-1 text-[13px]">Your choice is saved to your account and follows you to any device.</p>
          <div role="radiogroup" aria-labelledby="theme-h" className="mt-4 grid gap-3 sm:grid-cols-3">
            {SP_THEMES.map((t) => {
              const v = PREVIEW[t.value];
              const on = theme === t.value;
              const Icon = v.icon;
              return (
                <button key={t.value} role="radio" aria-checked={on} onClick={() => setTheme(t.value)} className="rounded-2xl p-3 text-left"
                  style={{ border: (on ? "3px" : "var(--sp-border-w)") + " solid " + (on ? "var(--sp-accent)" : "var(--sp-line)") }}>
                  <div className="rounded-xl p-3" style={{ background: v.bg, color: v.fg, border: "1px solid rgba(128,128,128,.35)" }}>
                    <div className="flex items-center justify-between"><Icon size={16} /><span className="h-3 w-10 rounded-full" style={{ background: v.acc }} /></div>
                    <div className="mt-3 h-2 w-3/4 rounded-full" style={{ background: v.fg, opacity: 0.6 }} />
                    <div className="mt-2 h-2 w-1/2 rounded-full" style={{ background: v.fg, opacity: 0.3 }} />
                  </div>
                  <div className="mt-3 text-[14px] font-bold">{t.label}</div>
                  <div className="sp-muted text-[12px]">{v.note}</div>
                </button>
              );
            })}
          </div>
        </section>

        <button onClick={signOut} className="sp-btn sp-btn-ghost lg:col-span-2"><LogOut size={16} /> Sign out</button>
      </div>
    </>
  );
}
