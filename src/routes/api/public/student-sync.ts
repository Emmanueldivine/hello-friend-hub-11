import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const messageSchema = z.object({
  id: z.string().max(120).optional(),
  from: z.string().max(120).optional(),
  text: z.string().max(4000),
  at: z.string().max(60).optional(),
});

const payloadSchema = z.object({
  user: z.object({
    name: z.string().max(160).optional(),
    email: z.string().max(160).optional(),
    phone: z.string().max(60).optional(),
    school: z.string().max(160).optional(),
  }),
  assignments: z
    .array(
      z.object({
        id: z.string().max(120),
        title: z.string().max(300).optional(),
        courseCode: z.string().max(60).optional(),
        description: z.string().max(4000).optional(),
        price: z.union([z.number(), z.string()]).optional(),
        status: z.string().max(60).optional(),
        progress: z.number().optional(),
        createdAt: z.string().max(60).optional(),
      }),
    )
    .max(200)
    .optional(),
  chats: z
    .array(
      z.object({
        key: z.string().max(160),
        staffName: z.string().max(160).optional(),
        messages: z.array(messageSchema).max(300),
      }),
    )
    .max(50)
    .optional(),
});

const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export const Route = createFileRoute("/api/public/student-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorization = request.headers.get("authorization") ?? "";
        const token = authorization.startsWith("Bearer ")
          ? authorization.slice("Bearer ".length).trim()
          : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabaseUrl = process.env['SUPABASE_URL'];
        const supabaseKey = process.env['SUPABASE_PUBLISHABLE_KEY'];
        if (!supabaseUrl || !supabaseKey) {
          return new Response("Service unavailable", { status: 503 });
        }
        const authClient = createClient<Database>(supabaseUrl, supabaseKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: authData, error: authError } = await authClient.auth.getUser(token);
        if (authError || !authData.user) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const parsed = payloadSchema.safeParse(body);
        if (!parsed.success) return new Response("Invalid payload", { status: 400 });
        const data = parsed.data;

        const email = (authData.user.email || "").trim().toLowerCase();
        const phone = (data.user.phone || "").trim();
        if (!email) return new Response("Authenticated account has no email", { status: 400 });
        const studentId = authData.user.id;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1. Student profile
        const profileFields = {
          id: studentId,
          full_name: data.user.name?.trim() || email,
          email,
          phone: phone || null,
          school: data.user.school || null,
          last_seen_at: new Date().toISOString(),
        };
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .upsert(profileFields, { onConflict: "id" });
        if (profileError) return new Response("Sync failed", { status: 500 });

        // 2. Orders from student assignments
        for (const a of data.assignments ?? []) {
          const reference = `UH-${a.id}`;
          const row = {
            reference,
            student_id: studentId,
            title: a.title?.trim() || a.courseCode || "Assignment order",
            amount: num(a.price),
            commission: Math.round(num(a.price) * 0.15 * 100) / 100,
            status: "pending" as const,
            progress: 0,
          };
          const { data: found } = await supabaseAdmin
            .from("orders")
            .select("id")
            .eq("reference", reference)
            .maybeSingle();
          if (found) {
            await supabaseAdmin
              .from("orders")
              .update({ title: row.title, amount: row.amount, commission: row.commission })
              .eq("id", found.id);
          } else {
            await supabaseAdmin.from("orders").insert(row);
          }
        }

        // 3. Chats + messages
        for (const c of data.chats ?? []) {
          const subject = c.staffName ? `Chat with ${c.staffName}` : `Conversation ${c.key}`;
          const { data: chat } = await supabaseAdmin
            .from("chats")
            .select("id")
            .eq("student_id", studentId)
            .eq("subject", subject)
            .maybeSingle();
          let chatId = chat?.id ?? null;
          if (!chatId) {
            const { data: createdChat } = await supabaseAdmin
              .from("chats")
              .insert({ student_id: studentId, subject })
              .select("id")
              .single();
            chatId = createdChat?.id ?? null;
          }
          if (!chatId) continue;
          const { count } = await supabaseAdmin
            .from("chat_messages")
            .select("id", { count: "exact", head: true })
            .eq("chat_id", chatId);
          const newMessages = c.messages.slice(count ?? 0);
          if (newMessages.length) {
            await supabaseAdmin.from("chat_messages").insert(
              newMessages.map((m) => ({
                chat_id: chatId as string,
                sender_id: studentId,
                sender_name: data.user.name || "Student",
                body: m.text,
              })),
            );
          }
        }

        return Response.json({ ok: true, studentId });
      },
    },
  },
});
