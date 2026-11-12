import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StudentPublicFrame } from "@/components/student/StudentShell";

export const Route = createFileRoute("/student/login")({
  head: () => ({
    meta: [
      { title: "Student Sign In | Unieveryhelp" },
      { name: "description", content: "Sign in or create your Unieveryhelp student account." },
      { property: "og:title", content: "Student Sign In | Unieveryhelp" },
      { property: "og:description", content: "Sign in or create your Unieveryhelp student account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentLogin,
});

const post = (body: object) =>
  fetch("/api/public/student-account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

type Mode = "login" | "create" | "forgot";

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="sp-label">{label}</label>
      {children}
      {hint}
    </div>
  );
}

function StudentLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [uStatus, setUStatus] = useState<{ state: "" | "checking" | "ok" | "taken" | "bad"; suggestions: string[] }>({ state: "", suggestions: [] });
  const [remember, setRemember] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"start" | "code" | "reset">("start");
  const [code, setCode] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/student/dashboard", replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    if (mode !== "create" || !username) return setUStatus({ state: "", suggestions: [] });
    if (!/^[A-Za-z0-9_]{3,12}$/.test(username)) return setUStatus({ state: "bad", suggestions: [] });
    setUStatus({ state: "checking", suggestions: [] });
    const t = setTimeout(async () => {
      const r = await post({ action: "check", username }).then((x) => x.json()).catch(() => null);
      if (r) setUStatus({ state: r.taken ? "taken" : "ok", suggestions: r.suggestions ?? [] });
    }, 500);
    return () => clearTimeout(t);
  }, [username, mode]);

  async function signIn(id: string) {
    const res = await post({ action: "login", identifier: id, password });
    const json = await res.json().catch(() => ({}));
    if (res.status === 404) throw new Error("User doesn't exist. Create a new account to enjoy Unieveryhelp.");
    if (res.status === 401) throw new Error("Incorrect username or password.");
    if (!res.ok || !json.authEmail) throw new Error("Unable to sign in. Please try again.");
    const { error: sErr } = await supabase.auth.signInWithPassword({ email: json.authEmail, password });
    if (sErr) throw new Error("Incorrect username or password.");
    if (remember) localStorage.setItem("uh_remember_until", String(Date.now() + 30 * 864e5));
    else localStorage.removeItem("uh_remember_until");
    navigate({ to: "/student/dashboard", replace: true });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "forgot") return await recover();
      if (mode === "login") return await signIn(identifier);
      if (fullName.trim().length < 3) throw new Error("Please enter your full name.");
      if (!/^0\d{10}$/.test(phone)) throw new Error("Enter a valid 11-digit phone number, e.g 08012345678.");
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid personal email address.");
      if (uStatus.state === "taken") throw new Error("That username is taken. Pick one of the suggestions.");
      if (password.length < 6) throw new Error("Password must be at least 6 characters.");
      const res = await post({ action: "signup", fullName: fullName.trim(), phone, email: email.trim().toLowerCase(), username: username.toLowerCase(), password });
      const json = await res.json().catch(() => ({}));
      if (json.error === "username_taken") {
        setUStatus({ state: "taken", suggestions: json.suggestions ?? [] });
        throw new Error("That username is taken. Pick one of the suggestions.");
      }
      if (json.error === "phone_taken") throw new Error("This phone number is already registered. Please sign in.");
      if (json.error === "email_taken") throw new Error("This email is already registered. Please sign in.");
      if (!res.ok) throw new Error("Unable to create account. Please check your details.");
      toast.success("Account created. Signing you in…");
      await signIn(username.toLowerCase());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function recover() {
    if (step === "start") {
      const res = await post({ action: "forgot_start", username: identifier, phone, email: email.trim().toLowerCase() });
      if (!res.ok) throw new Error("We could not match those details to an account. Check them and try again.");
      toast.success("A 6-digit code was sent to your email.");
      return setStep("code");
    }
    if (step === "code") {
      const res = await post({ action: "forgot_verify", username: identifier, code });
      if (!res.ok) throw new Error("That code is wrong or has expired.");
      return setStep("reset");
    }
    if (password.length < 6) throw new Error("Password must be at least 6 characters.");
    const res = await post({ action: "forgot_reset", username: identifier, code, password });
    if (!res.ok) throw new Error("Unable to reset your password. Request a new code.");
    toast.success("Password changed. Please sign in.");
    setMode("login");
    setStep("start");
    setPassword("");
    setCode("");
  }

  const tab = (m: Mode, label: string) => (
    <button type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(""); setStep("start"); }}
      className="flex-1 rounded-[10px] py-2.5 text-[14px] font-bold"
      style={{ background: mode === m ? "var(--sp-accent)" : "transparent", color: mode === m ? "var(--sp-accent-ink)" : "var(--sp-muted)" }}>
      {label}
    </button>
  );
  const statusText = { "": "", checking: "Checking…", ok: "Available", taken: "Taken", bad: "3-12 characters, letters, numbers or _ only" }[uStatus.state];
  const statusColor = uStatus.state === "ok" ? "var(--sp-ok)" : uStatus.state === "checking" ? "var(--sp-muted)" : "var(--sp-danger)";
  const passwordInput = (
    <div className="relative">
      <input className="sp-field pr-11" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} />
      <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)} className="absolute right-3 top-3.5 sp-muted">
        {show ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  );

  return (
    <StudentPublicFrame>
      <form onSubmit={submit} className="sp-card p-6">
        {mode !== "forgot" && (
          <div role="tablist" className="mb-5 flex gap-1 rounded-xl p-1" style={{ background: "var(--sp-surface-2)" }}>
            {tab("login", "Sign In")}
            {tab("create", "Create Account")}
          </div>
        )}
        <h1 className="mb-4 text-[22px] font-extrabold">
          {mode === "login" ? "Welcome back" : mode === "create" ? "Create your account" : "Reset your password"}
        </h1>

        {mode === "login" && (
          <Field label="Username or phone">
            <input className="sp-field" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoComplete="username" maxLength={40} />
          </Field>
        )}

        {mode === "create" && (
          <>
            <Field label="Full Name"><input className="sp-field" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} placeholder="e.g Emmanuel Divine" required /></Field>
            <Field label="Phone Number"><input className="sp-field" type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} maxLength={11} placeholder="e.g 08012345678" required /></Field>
            <Field label="Personal Email" hint={<small className="sp-muted">Used to send your password reset code.</small>}>
              <input className="sp-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} placeholder="e.g yourname@gmail.com" required />
            </Field>
            <Field label="Username" hint={
              <div className="mt-1 text-[12px] font-semibold" style={{ color: statusColor }}>
                {statusText}
                {uStatus.state === "taken" && uStatus.suggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {uStatus.suggestions.map((s) => (
                      <button key={s} type="button" onClick={() => setUsername(s)} className="rounded-full px-3 py-1" style={{ border: "var(--sp-border-w) solid var(--sp-line)", color: "var(--sp-ink)" }}>{s}</button>
                    ))}
                  </div>
                )}
              </div>}>
              <input className="sp-field" value={username} onChange={(e) => setUsername(e.target.value.trim())} maxLength={12} placeholder="e.g Emmacorn" required autoComplete="username" />
            </Field>
          </>
        )}

        {mode === "forgot" && step === "start" && (
          <>
            <Field label="Username"><input className="sp-field" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required maxLength={40} /></Field>
            <Field label="Phone Number"><input className="sp-field" type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} maxLength={11} required /></Field>
            <Field label="Personal Email"><input className="sp-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
          </>
        )}
        {mode === "forgot" && step === "code" && (
          <Field label="6-digit code" hint={<small className="sp-muted">Check your email inbox and spam folder.</small>}>
            <input className="sp-field tracking-[0.4em]" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} required minLength={6} />
          </Field>
        )}

        {(mode !== "forgot" || step === "reset") && <Field label={mode === "forgot" ? "New password" : "Password"}>{passwordInput}</Field>}

        {mode === "login" && (
          <div className="mb-4 flex items-center justify-between text-[13px]">
            <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me</label>
            <button type="button" className="font-bold underline" onClick={() => { setMode("forgot"); setStep("start"); setError(""); }}>Forgot password?</button>
          </div>
        )}

        {error && <p role="alert" className="mb-3 text-[14px] font-medium" style={{ color: "var(--sp-danger)" }}>{error}</p>}
        <button type="submit" disabled={busy} className="sp-btn sp-btn-block">
          {busy && <Loader2 size={18} className="animate-spin" />}
          {mode === "login" ? (busy ? "Signing in…" : "Sign In") : mode === "create" ? (busy ? "Creating account…" : "Create Account")
            : step === "start" ? "Send code" : step === "code" ? "Verify code" : "Change password"}
        </button>
        {mode === "forgot" && (
          <button type="button" className="mt-3 w-full text-[13px] font-bold underline" onClick={() => { setMode("login"); setError(""); }}>Back to sign in</button>
        )}
      </form>
    </StudentPublicFrame>
  );
}
