import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  avatarUrl: z.string().url().optional().or(z.literal("")),
  permissions: z.array(z.string()).default([]),
});

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Only the super admin can manage sub-admins.");
}

const OWNER_EMAIL = "emmanueldivine042@gmail.com";

function publicAuthClient() {
  return import("@supabase/supabase-js").then(({ createClient }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    return createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
  });
}

/** Username + password login. The email stays on the server and is never sent to the browser. */
export const adminUsernameLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ username: z.string().trim().min(1).max(100), password: z.string().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    const fail = { ok: false as const, error: "Invalid username or password." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .ilike("username", data.username.replace(/[%_]/g, "\\$&"))
      .maybeSingle();
    if (!profile?.email) return fail;
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", profile.id)
      .in("role", ["admin", "super_admin"]);
    const isOwner = profile.email.toLowerCase() === OWNER_EMAIL;
    if (!isOwner && !(roles?.length)) return fail;

    const client = await publicAuthClient();
    const { data: auth, error } = await client.auth.signInWithPassword({
      email: profile.email,
      password: data.password,
    });
    if (error || !auth.session) return fail;

    if (isOwner && !roles?.some((r) => r.role === "super_admin")) {
      await supabaseAdmin.from("user_roles").upsert({ user_id: profile.id, role: "super_admin" }, { onConflict: "user_id,role" });
    }
    return {
      ok: true as const,
      access_token: auth.session.access_token,
      refresh_token: auth.session.refresh_token,
    };
  });

/** Sends a 6-digit recovery code, only for admin accounts. Always returns ok to avoid leaking which emails exist. */
export const sendAdminRecoveryCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ email: z.string().trim().email().max(255) }).parse(data))
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin.from("profiles").select("id").ilike("email", email).maybeSingle();
    if (!profile) return { ok: true };
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", profile.id)
      .in("role", ["admin", "super_admin"]);
    if (!roles?.length) return { ok: true };
    const client = await publicAuthClient();
    const { error } = await client.auth.resetPasswordForEmail(email);
    if (error) console.error("recovery code error", error.message);
    return { ok: true };
  });

export const createSubAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (created.error || !created.data.user) {
      throw new Error(created.error?.message ?? "Could not create the sub-admin account.");
    }
    const uid = created.data.user.id;

    await supabaseAdmin.from("profiles").upsert({
      id: uid,
      full_name: data.fullName,
      email: data.email,
      avatar_url: data.avatarUrl || null,
    });
    await supabaseAdmin.from("user_roles").upsert({ user_id: uid, role: "admin" });
    if (data.permissions.length) {
      await supabaseAdmin
        .from("admin_permissions")
        .upsert(data.permissions.map((permission) => ({ admin_id: uid, permission })));
    }
    return { id: uid };
  });

export const updateSubAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ adminId: z.string().uuid(), permissions: z.array(z.string()) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("admin_permissions").delete().eq("admin_id", data.adminId);
    if (data.permissions.length) {
      await supabaseAdmin
        .from("admin_permissions")
        .insert(data.permissions.map((permission) => ({ admin_id: data.adminId, permission })));
    }
    return { ok: true };
  });

export const deleteSubAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ adminId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: superRows } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", data.adminId)
      .eq("role", "super_admin")
      .limit(1);
    if ((superRows?.length ?? 0) > 0) throw new Error("A super admin account cannot be removed.");

    await supabaseAdmin.from("admin_permissions").delete().eq("admin_id", data.adminId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.adminId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.adminId);
    await supabaseAdmin.auth.admin.deleteUser(data.adminId);
    return { ok: true };
  });
