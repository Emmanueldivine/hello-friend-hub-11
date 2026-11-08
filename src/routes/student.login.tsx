import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StudentShell, btnStyle, inputStyle, studentTheme } from "@/components/student/StudentShell";

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

function StudentLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "create">("login");
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

  // Live username availability while typing (signup only)
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
      if (mode === "login") return await signIn(identifier);
      if (fullName.trim().length < 2) throw new Error("Please enter your full name.");
      if (!/^0\d{10}$/.test(phone)) throw new Error("Enter a valid 11-digit phone number, e.g 08012345678.");
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid personal email address.");
      if (uStatus.state === "taken") throw new Error("That username is taken. Pick one of the suggestions.");
      if (password.length < 6) throw new Error("Password must be at least 6 characters.");
      const res = await post({ action: "signup", fullName: fullName.trim(), phone, email: email.trim().toLowerCase(), username, password });
      const json = await res.json().catch(() => ({}));
      if (json.error === "username_taken") {
        setUStatus({ state: "taken", suggestions: json.suggestions ?? [] });
        throw new Error("That username is taken. Pick one of the suggestions.");
      }
      if (json.error === "phone_taken") throw new Error("This phone number is already registered. Please sign in.");
      if (json.error === "email_taken") throw new Error("This email is already registered. Please sign in.");
      if (!res.ok) throw new Error("Unable to create account. Please check your details.");
      await signIn(username);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const tab = (m: "login" | "create", label: string) => (
    <button type="button" onClick={() => { setMode(m); setError(""); }}
      style={{ flex: 1, padding: 10, border: 0, borderRadius: 10, fontWeight: 700, cursor: "pointer",
        background: mode === m ? studentTheme.navy : "transparent", color: mode === m ? "#fff" : studentTheme.navy }}>
      {label}
    </button>
  );
  const field = (label: string, el: React.ReactNode, hint?: React.ReactNode) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontWeight: 600, fontSize: 14 }}>{label}</label>
      <div style={{ marginTop: 6 }}>{el}</div>
      {hint}
    </div>
  );
  const statusText = { "": "", checking: "Checking…", ok: "✓ Available", taken: "✗ Taken", bad: "3-12 characters, letters/numbers/_ only" }[uStatus.state];
  const statusColor = uStatus.state === "ok" ? "#15803d" : uStatus.state === "checking" ? "#64748b" : "#b91c1c";

  return (
    <StudentShell>
      <form onSubmit={submit} style={{ background: "#fff", borderRadius: 16, padding: 22, marginTop: 20, boxShadow: "0 4px 18px rgba(10,25,49,.08)" }}>
        <div style={{ display: "flex", gap: 6, background: studentTheme.paper, padding: 4, borderRadius: 12, marginBottom: 18 }}>
          {tab("login", "Sign In")}
          {tab("create", "Create Account")}
        </div>
        <h1 style={{ marginTop: 0, fontSize: 22 }}>{mode === "login" ? "Welcome back" : "Create your account"}</h1>

        {mode === "login" ? (
          field("Username or phone", <input style={inputStyle} value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoComplete="username" maxLength={40} />)
        ) : (
          <>
            {field("Full Name", <input style={inputStyle} value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} placeholder="e.g Emmanuel Divine" required />)}
            {field("Phone Number", <input style={inputStyle} type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} maxLength={11} placeholder="e.g 08012345678" required />)}
            {field("Personal Email", <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} placeholder="e.g yourname@gmail.com" required />,
              <small style={{ color: "#94a3b8" }}>Used to send your password reset code.</small>)}
            {field("Username", <input style={inputStyle} value={username} onChange={(e) => setUsername(e.target.value.trim())} maxLength={12} placeholder="e.g Emmacorn" required autoComplete="username" />,
              <div style={{ fontSize: 12, fontWeight: 600, color: statusColor, marginTop: 4 }}>
                {statusText}
                {uStatus.state === "taken" && uStatus.suggestions.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                    {uStatus.suggestions.map((s) => (
                      <button key={s} type="button" onClick={() => setUsername(s)} style={{ border: `1px solid ${studentTheme.line}`, background: "#fff", borderRadius: 999, padding: "4px 10px", cursor: "pointer", color: studentTheme.navy }}>{s}</button>
                    ))}
                  </div>
                )}
              </div>)}
          </>
        )}

        {field("Password",
          <div style={{ position: "relative" }}>
            <input style={inputStyle} type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} />
            <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)} style={{ position: "absolute", right: 10, top: 10, background: "none", border: 0, cursor: "pointer" }}>
              {show ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>)}

        {mode === "login" && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, marginBottom: 14 }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 600 }}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me
            </label>
            <a href="/#/forgot-password" style={{ color: studentTheme.navy, fontWeight: 700 }}>Forgot password?</a>
          </div>
        )}

        {error && <p role="alert" style={{ color: "#b91c1c", fontSize: 14 }}>{error}</p>}
        <button type="submit" disabled={busy} style={{ ...btnStyle, display: "flex", justifyContent: "center", gap: 8, opacity: busy ? 0.8 : 1 }}>
          {busy && <Loader2 size={18} className="animate-spin" />}
          {busy ? (mode === "login" ? "Signing in…" : "Creating account…") : mode === "login" ? "Sign In" : "Create Account"}
        </button>
      </form>
    </StudentShell>
  );
}
