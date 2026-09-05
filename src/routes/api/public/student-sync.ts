import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

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
  wallet: z.number().optional(),
  transactions: z
    .array(
      z.object({
        id: z.string().max(120).optional(),
        reference: z.string().max(120).optional(),
        amount: z.union([z.number(), z.string()]).optional(),
        type: z.string().max(40).optional(),
        status: z.string().max(40).optional(),
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

const ORDER_STATUS: Record<string, string> = {
  received: "pending",
  "awaiting writer": "pending",
  pending: "pending",
  "in progress": "in_progress",
  in_progress: "in_progress",
  "under review": "under_review",
  under_review: "under_review",
  completed: "completed",
  cancelled: "cancelled",
};

export const Route = createFileRoute("/api/public/student-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const parsed = payloadSchema.safeParse(body);
        if (!parsed.success) return new Response("Invalid payload", { status: 400 });
        const data = parsed.data;

        const email = (data.user.email || "").trim().toLowerCase();
        const phone = (data.user.phone || "").trim();
        if (!email && !phone) return new Response("Missing identity", { status: 400 });
        const identityEmail = email || `${phone.replace(/[^0-9]/g, "")}@portal.local`;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1. Student profile
        const { data: existing } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("email", identityEmail)
          .maybeSingle();

        let studentId = existing?.id ?? null;
        const profileFields = {
          full_name: data.user.name?.trim() || identityEmail,
          email: identityEmail,
          phone: phone || null,
          school: data.user.school || null,
          last_seen_at: new Date().toISOString(),
        };

        if (studentId) {
          await supabaseAdmin.from("profiles").update(profileFields).eq("id", studentId);
        } else {
          const { data: created, error } = await supabaseAdmin
            .from("profiles")
            .insert(profileFields)
            .select("id")
            .single();
          if (error || !created) return new Response("Sync failed", { status: 500 });
          studentId = created.id;
        }

        // 2. Orders from student assignments
        for (const a of data.assignments ?? []) {
          const reference = `UH-${a.id}`;
          const statusKey = (a.status || "").toLowerCase();
          const row = {
            reference,
            student_id: studentId,
            title: a.title?.trim() || a.courseCode || "Assignment order",
            amount: num(a.price),
            commission: Math.round(num(a.price) * 0.15 * 100) / 100,
            status: (ORDER_STATUS[statusKey] ?? "pending") as never,
            progress: Math.max(0, Math.min(100, Math.round(a.progress ?? 0))),
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

        // 3. Wallet balance
        const { data: wallet } = await supabaseAdmin
          .from("wallets")
          .select("id")
          .eq("user_id", studentId)
          .maybeSingle();
        if (typeof data.wallet === "number") {
          if (wallet) {
            await supabaseAdmin.from("wallets").update({ balance: data.wallet }).eq("id", wallet.id);
          } else {
            await supabaseAdmin
              .from("wallets")
              .insert({ user_id: studentId, balance: data.wallet });
          }
        }

        // 4. Transactions (insert new only)
        for (const t of data.transactions ?? []) {
          const reference = t.reference || `PSK-${t.id ?? ""}`;
          if (!reference) continue;
          const { data: found } = await supabaseAdmin
            .from("transactions")
            .select("id")
            .eq("reference", reference)
            .maybeSingle();
          if (found) continue;
          await supabaseAdmin.from("transactions").insert({
            user_id: studentId,
            reference,
            amount: num(t.amount),
            type: t.type || "funding",
            status: t.status || "success",
          });
        }

        // 5. Chats + messages
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
                sender_name: m.from || data.user.name || "Student",
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
