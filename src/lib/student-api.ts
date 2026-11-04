import { supabase } from "@/integrations/supabase/client";

export async function studentPortal(payload: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/public/student-portal", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
