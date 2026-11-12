import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OrderStatus = "pending" | "in_progress" | "under_review" | "completed" | "cancelled";

export type Order = {
  id: string;
  reference: string;
  title: string;
  course_code: string | null;
  amount: number;
  status: OrderStatus;
  progress: number;
  deadline: string | null;
  created_at: string;
  completed_at: string | null;
};
export type Tx = { id: string; amount: number; type: string; status: string; reference: string; created_at: string };
export type Profile = {
  full_name: string;
  username: string | null;
  phone: string | null;
  real_email: string | null;
  school: string | null;
  department: string | null;
  level: string | null;
};
export type Notice = { id: string; text: string; time: string; kind: "order" | "wallet" | "message"; to: "/student/assignments" | "/student/wallet" | "/student/messages" };

export const naira = (n: number | string | null | undefined) => `₦${Number(n ?? 0).toLocaleString()}`;

export const STATUS_META: Record<OrderStatus, { label: string; chip: string; step: number }> = {
  pending: { label: "Received", chip: "sp-chip-pending", step: 0 },
  in_progress: { label: "In Progress", chip: "sp-chip-progress", step: 1 },
  under_review: { label: "Under Review", chip: "sp-chip-review", step: 2 },
  completed: { label: "Completed", chip: "sp-chip-done", step: 3 },
  cancelled: { label: "Cancelled", chip: "sp-chip-cancel", step: -1 },
};

export function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}

/** The signed-in student (null once we know nobody is signed in). */
export function useStudentUser() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["sp", "user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
    staleTime: 60_000,
  });
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || event === "SIGNED_IN" || event === "USER_UPDATED") qc.invalidateQueries({ queryKey: ["sp"] });
    });
    return () => data.subscription.unsubscribe();
  }, [qc]);
  return { user: q.data ?? null, ready: !q.isLoading };
}

export function useStudentData(uid: string | undefined) {
  const profile = useQuery({
    queryKey: ["sp", "profile", uid],
    enabled: !!uid,
    queryFn: async () =>
      ((await supabase.from("profiles").select("full_name, username, phone, real_email, school, department, level").eq("id", uid!).maybeSingle()).data ?? null) as Profile | null,
  });
  const wallet = useQuery({
    queryKey: ["sp", "wallet", uid],
    enabled: !!uid,
    queryFn: async () => Number((await supabase.from("wallets").select("balance").eq("user_id", uid!).maybeSingle()).data?.balance ?? 0),
  });
  const orders = useQuery({
    queryKey: ["sp", "orders", uid],
    enabled: !!uid,
    queryFn: async () =>
      ((await supabase.from("orders").select("id, reference, title, course_code, amount, status, progress, deadline, created_at, completed_at").eq("student_id", uid!).order("created_at", { ascending: false })).data ?? []) as Order[],
  });
  const txs = useQuery({
    queryKey: ["sp", "txs", uid],
    enabled: !!uid,
    queryFn: async () =>
      ((await supabase.from("transactions").select("id, amount, type, status, reference, created_at").eq("user_id", uid!).order("created_at", { ascending: false }).limit(100)).data ?? []) as Tx[],
  });
  const staffMessages = useQuery({
    queryKey: ["sp", "staff-messages", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data: chats } = await supabase.from("chats").select("id").eq("student_id", uid!);
      const ids = (chats ?? []).map((c) => c.id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from("chat_messages")
        .select("id, sender_name, body, created_at, sender_id")
        .in("chat_id", ids)
        .or(`sender_id.is.null,sender_id.neq.${uid}`)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });
  return { profile, wallet, orders, txs, staffMessages };
}

/** Notifications are built from the student's real activity in the database. */
export function buildNotices(orders: Order[], txs: Tx[], staff: { id: string; sender_name: string | null; body: string; created_at: string }[]): Notice[] {
  const out: Notice[] = [];
  for (const o of orders) {
    out.push({ id: `o-${o.id}`, kind: "order", to: "/student/assignments", time: o.created_at, text: `Assignment "${o.title}" was received.` });
    if (o.status !== "pending") {
      const label = STATUS_META[o.status].label.toLowerCase();
      out.push({
        id: `s-${o.id}-${o.status}`, kind: "order", to: "/student/assignments",
        time: o.completed_at ?? o.created_at,
        text: o.status === "completed" ? `"${o.title}" is ready. Open it to download your solution.` : `"${o.title}" is now ${label}.`,
      });
    }
  }
  for (const t of txs) {
    const amt = naira(t.amount);
    const text = t.type === "topup" ? `Wallet funded with ${amt}.` : t.type === "refund" ? `${amt} was refunded to your wallet.` : `${amt} paid for an assignment.`;
    out.push({ id: `t-${t.id}`, kind: "wallet", to: "/student/wallet", time: t.created_at, text });
  }
  for (const m of staff) out.push({ id: `m-${m.id}`, kind: "message", to: "/student/messages", time: m.created_at, text: `${m.sender_name || "Support"}: ${m.body.slice(0, 80)}` });
  return out.sort((a, b) => +new Date(b.time) - +new Date(a.time)).slice(0, 40);
}

/** Live updates: any change to this student's rows refreshes the screen. */
export function useStudentRealtime(uid: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!uid) return;
    const refresh = () => qc.invalidateQueries({ queryKey: ["sp"] });
    const ch = supabase
      .channel(`sp-live-${uid}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `student_id=eq.${uid}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${uid}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${uid}` }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [uid, qc]);
}
