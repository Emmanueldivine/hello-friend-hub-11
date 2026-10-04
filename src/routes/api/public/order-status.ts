import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Returns the delivery state of the signed-in student's orders so the
 *  student portal progress bar can jump to 100% as soon as an admin
 *  marks an order completed. */
export const Route = createFileRoute("/api/public/order-status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authorization = request.headers.get("authorization") ?? "";
        const token = authorization.startsWith("Bearer ")
          ? authorization.slice("Bearer ".length).trim()
          : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabaseUrl = process.env["SUPABASE_URL"];
        const supabaseKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!supabaseUrl || !supabaseKey) {
          return new Response("Service unavailable", { status: 503 });
        }
        const authClient = createClient<Database>(supabaseUrl, supabaseKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: authData, error: authError } = await authClient.auth.getUser(token);
        if (authError || !authData.user) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: orders, error } = await supabaseAdmin
          .from("orders")
          .select("reference, status, progress, final_file_url, final_file_name, completed_at")
          .eq("student_id", authData.user.id);
        if (error) return new Response("Lookup failed", { status: 500 });

        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("school, department, level, matric_number, profile_completed")
          .eq("id", authData.user.id)
          .maybeSingle();

        const results = [];
        for (const o of orders ?? []) {
          let downloadUrl: string | null = null;
          if (o.final_file_url) {
            const { data: signed } = await supabaseAdmin.storage
              .from("order-final-files")
              .createSignedUrl(o.final_file_url, 60 * 60 * 24);
            downloadUrl = signed?.signedUrl ?? null;
          }
          results.push({
            assignmentId: String(o.reference ?? "").replace(/^UH-/, ""),
            status: o.status,
            progress: o.progress,
            completedAt: o.completed_at,
            fileName: o.final_file_name,
            downloadUrl,
          });
        }

        return Response.json(
          { orders: results, profile },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
