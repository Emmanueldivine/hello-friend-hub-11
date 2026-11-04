import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

/** Native student portal actions. Prices are computed on the server (same table as the original portal). */
const prices: Record<string, Record<string, number[]>> = {
  cheap: { "24": [1500, 2500, 3500, 4500, 5500, 7000, 9000], "48": [1000, 1800, 2600, 3400, 4200, 5500, 7000], "72": [600, 1000, 1600, 2200, 2800, 3800, 5000] },
  technical: { "24": [3000, 5000, 7000, 9000, 11000, 14000, 18000], "48": [2000, 3500, 5000, 6500, 8000, 10500, 13000], "72": [1500, 2500, 3500, 4500, 5500, 7000, 9000] },
};
export const priceFor = (track: string, pages: number, hours: string) =>
  prices[track]?.[hours]?.[Math.min(Math.max(pages || 1, 1), 7) - 1] ?? 0;

const body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("order"),
    title: z.string().trim().min(3).max(150),
    courseCode: z.string().trim().min(2).max(20),
    description: z.string().trim().min(10).max(5000),
    track: z.enum(["cheap", "technical"]),
    pages: z.number().int().min(1).max(7),
    hours: z.enum(["24", "48", "72"]),
    school: z.string().trim().max(120).optional(),
    department: z.string().trim().max(120).optional(),
    level: z.string().trim().max(20).optional(),
  }),
  z.object({ action: z.literal("topup"), amount: z.number().int().min(100).max(10_000_000) }),
]);

export const Route = createFileRoute("/api/public/student-portal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
        const anon = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data: u } = await anon.auth.getUser(token);
        if (!u.user) return Response.json({ error: "unauthorized" }, { status: 401 });
        const parsed = body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
        const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
        const uid = u.user.id;
        const d = parsed.data;

        const { data: wallet } = await admin.from("wallets").select("id, balance").eq("user_id", uid).maybeSingle();
        const balance = Number(wallet?.balance ?? 0);

        if (d.action === "topup") {
          const next = balance + d.amount;
          if (wallet) await admin.from("wallets").update({ balance: next }).eq("id", wallet.id);
          else await admin.from("wallets").insert({ user_id: uid, balance: next });
          await admin.from("transactions").insert({ user_id: uid, amount: d.amount, type: "topup", status: "success", reference: `TOP-${Date.now()}` });
          return Response.json({ ok: true, balance: next });
        }

        const { data: prof } = await admin.from("profiles").select("school, department, level").eq("id", uid).maybeSingle();
        const school = prof?.school || d.school, department = prof?.department || d.department, level = prof?.level || d.level;
        if (!school || !department || !level) return Response.json({ error: "profile_incomplete" }, { status: 400 });
        if (!prof?.school) await admin.from("profiles").update({ school, department, level, profile_completed: true }).eq("id", uid);

        const price = priceFor(d.track, d.pages, d.hours);
        if (balance < price) return Response.json({ error: "low_balance", required: price, balance }, { status: 402 });
        await admin.from("wallets").update({ balance: balance - price }).eq("id", wallet!.id);
        const reference = `UH-UH${Date.now()}`;
        const { data: order, error } = await admin.from("orders").insert({
          reference, student_id: uid, status: "pending", progress: 0,
          title: d.title, course_code: d.courseCode.toUpperCase(), description: d.description,
          amount: price, commission: Math.round(price * 0.15 * 100) / 100,
          deadline: new Date(Date.now() + Number(d.hours) * 36e5).toISOString(), student_files: [],
        }).select("id, reference, deadline").single();
        if (error || !order) {
          await admin.from("wallets").update({ balance }).eq("id", wallet!.id);
          return Response.json({ error: "failed" }, { status: 500 });
        }
        await admin.from("transactions").insert({ user_id: uid, amount: price, type: "payment", status: "success", reference, order_id: order.id });
        return Response.json({ ok: true, order: { ...order, price } });
      },
    },
  },
});
