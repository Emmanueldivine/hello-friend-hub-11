import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StudentShell, btnStyle, inputStyle } from "@/components/student/StudentShell";

export const Route = createFileRoute("/student/login")({
  head: () => ({
    meta: [
      { title: "Student Sign In | Unieveryhelp" },
      { name: "description", content: "Sign in to your Unieveryhelp student account." },
      { property: "og:title", content: "Student Sign In | Unieveryhelp" },
      { property: "og:description", content: "Sign in to your Unieveryhelp student account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentLogin,
});

function StudentLogin() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/public/student-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", identifier, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 404) throw new Error("User doesn't exist. Create a new account to enjoy Unieveryhelp.");
      if (res.status === 401) throw new Error("Incorrect username or password.");
      if (!res.ok || !json.authEmail) throw new Error("Unable to sign in. Please try again.");
      const { error: sErr } = await supabase.auth.signInWithPassword({ email: json.authEmail, password });
      if (sErr) throw new Error("Incorrect username or password.");
      navigate({ to: "/student/dashboard", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <StudentShell>
      <form onSubmit={submit} style={{ background: "#fff", borderRadius: 16, padding: 22, marginTop: 30, boxShadow: "0 4px 18px rgba(10,25,49,.08)" }}>
        <h1 style={{ marginTop: 0, fontSize: 22 }}>Welcome back</h1>
        <label style={{ fontWeight: 600 }}>Username or phone</label>
        <input style={{ ...inputStyle, margin: "6px 0 14px" }} value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoComplete="username" />
        <label style={{ fontWeight: 600 }}>Password</label>
        <div style={{ position: "relative", margin: "6px 0 14px" }}>
          <input style={inputStyle} type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)} style={{ position: "absolute", right: 10, top: 10, background: "none", border: 0, cursor: "pointer" }}>
            {show ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
        {error && <p role="alert" style={{ color: "#b91c1c", fontSize: 14 }}>{error}</p>}
        <button type="submit" disabled={busy} style={{ ...btnStyle, display: "flex", justifyContent: "center", gap: 8, opacity: busy ? 0.8 : 1 }}>
          {busy && <Loader2 size={18} className="animate-spin" />}
          {busy ? "Signing in…" : "Sign In"}
        </button>
        <p style={{ fontSize: 13, textAlign: "center", marginTop: 14 }}>
          New here or forgot password? <a href="/" style={{ color: "#0a1931", fontWeight: 700 }}>Use the main portal</a>
        </p>
      </form>
    </StudentShell>
  );
}
