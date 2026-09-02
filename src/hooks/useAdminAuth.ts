import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { SUPER_ADMIN_ONLY } from "@/lib/admin-permissions";

export type AdminSession = {
  userId: string;
  email: string | null;
  fullName: string;
  avatarUrl: string | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  permissions: string[];
};

export function useAdminAuth() {
  const queryClient = useQueryClient();
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      queryClient.invalidateQueries({ queryKey: ["admin-session"] });
    });
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
      setAuthReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  const query = useQuery({
    queryKey: ["admin-session", userId],
    enabled: authReady,
    queryFn: async (): Promise<AdminSession | null> => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;

      const [{ data: roles }, { data: perms }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("admin_permissions").select("permission").eq("admin_id", user.id),
        supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).maybeSingle(),
      ]);

      const roleList = (roles ?? []).map((r) => r.role as string);
      const isSuperAdmin = roleList.includes("super_admin");
      const isAdmin = isSuperAdmin || roleList.includes("admin");

      return {
        userId: user.id,
        email: user.email ?? null,
        fullName: profile?.full_name || user.email || "Admin",
        avatarUrl: profile?.avatar_url ?? null,
        isSuperAdmin,
        isAdmin,
        permissions: (perms ?? []).map((p) => p.permission as string),
      };
    },
  });

  const session = query.data ?? null;

  const can = (area: string) => {
    if (!session?.isAdmin) return false;
    if (session.isSuperAdmin) return true;
    if ((SUPER_ADMIN_ONLY as readonly string[]).includes(area)) return false;
    if (area === "dashboard") return true;
    return session.permissions.includes(area);
  };

  return { session, can, loading: !authReady || query.isLoading, refetch: query.refetch };
}
