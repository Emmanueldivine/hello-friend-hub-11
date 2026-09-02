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
  const { data, error } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Only the super admin can manage sub-admins.");
}

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

    const { data: isSuper } = await supabaseAdmin.rpc("is_super_admin", { _user_id: data.adminId });
    if (isSuper) throw new Error("A super admin account cannot be removed.");

    await supabaseAdmin.from("admin_permissions").delete().eq("admin_id", data.adminId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.adminId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.adminId);
    await supabaseAdmin.auth.admin.deleteUser(data.adminId);
    return { ok: true };
  });
