import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

/** Real, server-backed student accounts so sign-ups survive closing the app
 *  and usernames are unique across every device. */
const DOMAIN = "students.unieveryhelp.com";
const emailFor = (username: string) => `${username.toLowerCase()}@${DOMAIN}`;

const emailSchema = z.string().trim().toLowerCase().email().max(120);
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("check"), username: z.string().max(40), phone: z.string().max(20).optional() }),
  z.object({
    action: z.literal("signup"),
    fullName: z.string().min(3).max(80),
    username: z.string().regex(/^[a-z0-9_]{3,12}$/),
    phone: z.string().regex(/^0\d{10}$/),
    email: emailSchema,
    password: z.string().min(6).max(72),
  }),
  z.object({ action: z.literal("login"), identifier: z.string().min(1).max(40), password: z.string().min(1).max(72) }),
  z.object({ action: z.literal("forgot_start"), username: z.string().min(1).max(40), phone: z.string().max(20), email: emailSchema }),
  z.object({ action: z.literal("forgot_verify"), username: z.string().min(1).max(40), code: z.string().regex(/^\d{6}$/) }),
  z.object({
    action: z.literal("forgot_reset"),
    username: z.string().min(1).max(40),
    code: z.string().regex(/^\d{6}$/),
    password: z.string().min(6).max(72),
  }),
]);

async function sha(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function findForReset(admin: Admin, username: string) {
  const { data } = await admin.from("profiles").select("id, username, phone, real_email").ilike("username", username.trim().toLowerCase()).limit(1);
  return data?.[0] ?? null;
}

/** Returns the live code row if the code is right; counts wrong tries (max 5). */
async function checkCode(admin: Admin, userId: string, code: string) {
  const { data } = await admin
    .from("password_reset_codes").select("*").eq("user_id", userId)
    .order("created_at", { ascending: false }).limit(1);
  const row = data?.[0];
  if (!row || new Date(row.expires_at).getTime() < Date.now() || row.attempts >= 5) return null;
  if (row.code_hash !== (await sha(`${userId}:${code}`))) {
    await admin.from("password_reset_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
    return null;
  }
  return row;
}

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

async function usernameTaken(admin: Admin, username: string) {
  const { data } = await admin.from("profiles").select("id").ilike("username", username).limit(1);
  if (data && data.length) return true;
  const { data: byEmail } = await admin.from("profiles").select("id").eq("email", emailFor(username)).limit(1);
  return !!(byEmail && byEmail.length);
}

async function phoneTaken(admin: Admin, phone: string) {
  const { data } = await admin.from("profiles").select("id").eq("phone", phone).limit(1);
  return !!(data && data.length);
}

async function suggest(admin: Admin, base: string) {
  const clean = base.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 8) || "student";
  const year = String(new Date().getFullYear()).slice(2);
  const pool = [
    `${clean}${year}`,
    `${clean}_${Math.floor(10 + Math.random() * 89)}`,
    `the${clean}`.slice(0, 12),
    `${clean}${Math.floor(100 + Math.random() * 899)}`,
    `${clean}_uh`,
  ];
  const out: string[] = [];
  for (const c of pool) {
    if (out.length >= 3) break;
    if (/^[a-z0-9_]{3,12}$/.test(c) && !(await usernameTaken(admin, c))) out.push(c);
  }
  return out;
}

export const Route = createFileRoute("/api/public/student-account")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed;
        try {
          parsed = bodySchema.safeParse(await request.json());
        } catch {
          return Response.json({ error: "bad_request" }, { status: 400 });
        }
        if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
        const body = parsed.data;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (body.action === "check") {
          const u = body.username.trim().toLowerCase();
          const taken = await usernameTaken(supabaseAdmin, u);
          const phone = body.phone ? await phoneTaken(supabaseAdmin, body.phone.trim()) : false;
          return Response.json({ taken, phoneTaken: phone, suggestions: taken ? await suggest(supabaseAdmin, u) : [] });
        }

        if (body.action === "signup") {
          if (await usernameTaken(supabaseAdmin, body.username)) {
            return Response.json({ error: "username_taken", suggestions: await suggest(supabaseAdmin, body.username) }, { status: 409 });
          }
          if (await phoneTaken(supabaseAdmin, body.phone)) {
            return Response.json({ error: "phone_taken" }, { status: 409 });
          }
          const { data: em } = await supabaseAdmin.from("profiles").select("id").ilike("real_email", body.email).limit(1);
          if (em && em.length) return Response.json({ error: "email_taken" }, { status: 409 });
          const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
            email: emailFor(body.username),
            password: body.password,
            email_confirm: true,
            user_metadata: { full_name: body.fullName, username: body.username, phone: body.phone },
          });
          if (error || !created.user) {
            return Response.json({ error: "username_taken", suggestions: await suggest(supabaseAdmin, body.username) }, { status: 409 });
          }
          await supabaseAdmin.from("profiles").upsert(
            {
              id: created.user.id,
              full_name: body.fullName,
              username: body.username,
              phone: body.phone,
              email: emailFor(body.username),
              real_email: body.email,
            },
            { onConflict: "id" },
          );
          return Response.json({ ok: true });
        }

        if (body.action === "forgot_start") {
          const mismatch = Response.json({ error: "mismatch" }, { status: 400 });
          const p = await findForReset(supabaseAdmin, body.username);
          if (!p || !p.real_email || p.phone !== body.phone.trim() || p.real_email.toLowerCase() !== body.email) return mismatch;
          const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
          await supabaseAdmin.from("password_reset_codes").delete().eq("user_id", p.id);
          await supabaseAdmin.from("password_reset_codes").insert({
            user_id: p.id,
            code_hash: await sha(`${p.id}:${code}`),
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          });
          const { sendResetCodeEmail } = await import("@/lib/reset-email.server");
          const sent = await sendResetCodeEmail(p.real_email, code);
          return Response.json({ ok: true, sent });
        }

        if (body.action === "forgot_verify" || body.action === "forgot_reset") {
          const p = await findForReset(supabaseAdmin, body.username);
          const row = p ? await checkCode(supabaseAdmin, p.id, body.code) : null;
          if (!p || !row) return Response.json({ error: "bad_code" }, { status: 400 });
          if (body.action === "forgot_verify") return Response.json({ ok: true });
          const { error } = await supabaseAdmin.auth.admin.updateUserById(p.id, { password: body.password });
          if (error) return Response.json({ error: "failed" }, { status: 500 });
          await supabaseAdmin.from("password_reset_codes").delete().eq("user_id", p.id);
          return Response.json({ ok: true });
        }

        // login: resolve username or phone, then verify the password
        const id = body.identifier.trim();
        const isPhone = /^0\d{10}$/.test(id);
        const { data: rows } = isPhone
          ? await supabaseAdmin.from("profiles").select("*").eq("phone", id).limit(1)
          : await supabaseAdmin.from("profiles").select("*").ilike("username", id.toLowerCase()).limit(1);
        let profile = rows?.[0] ?? null;
        if (!profile && !isPhone) {
          const { data: byEmail } = await supabaseAdmin.from("profiles").select("*").eq("email", emailFor(id)).limit(1);
          profile = byEmail?.[0] ?? null;
        }
        if (!profile || !profile.email?.endsWith(`@${DOMAIN}`)) {
          return Response.json({ error: "not_found" }, { status: 404 });
        }
        const pub = createClient<Database>(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { error: signErr } = await pub.auth.signInWithPassword({ email: profile.email, password: body.password });
        if (signErr) return Response.json({ error: "wrong_password" }, { status: 401 });
        return Response.json({
          ok: true,
          user: {
            fullName: profile.full_name,
            username: profile.username || profile.email.split("@")[0],
            phone: profile.phone || "",
            school: profile.school || undefined,
            schoolName: profile.school || undefined,
            department: profile.department || undefined,
            level: profile.level || undefined,
            matricNumber: profile.matric_number || "",
            profileCompleted: profile.profile_completed || undefined,
            role: "student",
          },
        });
      },
    },
  },
});
