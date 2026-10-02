import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { adminUsernameLogin, sendAdminRecoveryCode } from "@/lib/admin.functions";
import { clearLegacyStorage } from "@/lib/clear-legacy-storage";

export const Route = createFileRoute("/admin_/login")({
  head: () => ({
    meta: [
      { title: "Admin Sign In — Unieveryhelp" },
      { name: "description", content: "Staff sign-in for the Unieveryhelp admin dashboard." },
      { property: "og:title", content: "Admin Sign In — Unieveryhelp" },
      { property: "og:description", content: "Staff sign-in for the Unieveryhelp admin dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLoginPage,
});

export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  minLength,
  required = true,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        autoComplete={autoComplete}
        minLength={minLength}
        onChange={(e) => onChange(e.target.value)}
        className="pr-10"
        required={required}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function Brand() {
  return (
    <div className="mb-6 flex items-center gap-3">
      <span className="grid size-10 place-items-center rounded-xl bg-accent font-black text-accent-foreground">
        UH
      </span>
      <div>
        <h1 className="text-lg font-bold leading-tight">Unieveryhelp Admin</h1>
        <p className="text-xs text-muted-foreground">Staff access only</p>
      </div>
    </div>
  );
}

type Step = "login" | "email" | "code";

function AdminLoginPage() {
  const navigate = useNavigate();
  const login = useServerFn(adminUsernameLogin);
  const sendCode = useServerFn(sendAdminRecoveryCode);
  const [step, setStep] = useState<Step>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    clearLegacyStorage();
  }, []);

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await login({ data: { username, password } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const { error } = await supabase.auth.setSession({
        access_token: res.access_token,
        refresh_token: res.refresh_token,
      });
      if (error) throw error;
      navigate({ to: "/admin", replace: true });
    } catch {
      toast.error("Could not sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await sendCode({ data: { email } });
      toast.success("If this is a recovery email, a 6-digit code has been sent.");
      setStep("code");
    } catch {
      toast.error("Could not send the code. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "recovery",
    });
    setBusy(false);
    if (error) {
      toast.error("Incorrect or expired code.");
      return;
    }
    toast.success("Verified. Please set a new password.");
    navigate({ to: "/admin/settings", search: { reset: "1" } as never, replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-sidebar px-4 py-10">
      <Card className="w-full max-w-sm p-8">
        <Brand />
        {step === "login" ? (
          <>
            <form className="space-y-4" onSubmit={submitLogin}>
              <div className="space-y-1.5">
                <Label htmlFor="al-user">Username</Label>
                <Input
                  id="al-user"
                  value={username}
                  autoComplete="username"
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="al-pass">Password</Label>
                <PasswordInput
                  id="al-pass"
                  value={password}
                  onChange={setPassword}
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
            <button
              type="button"
              onClick={() => setStep("email")}
              className="mt-4 w-full text-xs text-muted-foreground underline underline-offset-4"
            >
              Forgot Password?
            </button>
          </>
        ) : step === "email" ? (
          <form className="space-y-4" onSubmit={submitEmail}>
            <h2 className="text-base font-bold">Enter your recovery email</h2>
            <Input
              id="al-email"
              type="email"
              aria-label="Recovery email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Sending…" : "Send code"}
            </Button>
            <button
              type="button"
              onClick={() => setStep("login")}
              className="w-full text-xs text-muted-foreground underline underline-offset-4"
            >
              Back to sign in
            </button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={submitCode}>
            <h2 className="text-base font-bold">Enter the 6-digit code</h2>
            <p className="text-xs text-muted-foreground">Check your inbox for the code we sent.</p>
            <Input
              id="al-code"
              inputMode="numeric"
              aria-label="6-digit code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
            />
            <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
              {busy ? "Verifying…" : "Verify code"}
            </Button>
            <button
              type="button"
              onClick={() => setStep("email")}
              className="w-full text-xs text-muted-foreground underline underline-offset-4"
            >
              Resend code
            </button>
          </form>
        )}
      </Card>
    </main>
  );
}
