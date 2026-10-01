import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Pill, statusTone } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { naira } from "@/lib/admin-permissions";

export type AdminOrder = {
  id: string;
  reference: string;
  title: string;
  amount: number | string;
  commission: number | string;
  status: string;
  progress: number;
  created_at: string;
  deadline: string | null;
  description: string | null;
  course_code: string | null;
  student_files: unknown;
  final_file_url: string | null;
  final_file_name: string | null;
  completed_at: string | null;
  student?: { full_name?: string | null; email?: string | null; school?: string | null; phone?: string | null };
};

const when = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString() : "—";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium break-words">{value || "—"}</p>
    </div>
  );
}

export function OrderDetailDialog({
  order,
  onOpenChange,
}: {
  order: AdminOrder | null;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const files = Array.isArray(order?.student_files) ? (order?.student_files as string[]) : [];

  const complete = useMutation({
    mutationFn: async () => {
      if (!order) return;
      let path = order.final_file_url;
      let name = order.final_file_name;
      if (file) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        path = `${order.id}/${Date.now()}-${safe}`;
        const { error: uploadError } = await supabase.storage
          .from("order-final-files")
          .upload(path, file, { upsert: true });
        if (uploadError) throw uploadError;
        name = file.name;
      }
      if (!path) throw new Error("Upload the final file before marking as completed.");
      const { error } = await supabase
        .from("orders")
        .update({
          status: "completed" as never,
          progress: 100,
          final_file_url: path,
          final_file_name: name,
          completed_at: new Date().toISOString(),
        })
        .eq("id", order.id);
      if (error) throw error;
    },
    onMutate: () => setBusy(true),
    onSettled: () => setBusy(false),
    onSuccess: () => {
      toast.success("Order marked completed — the student can download it now.");
      setFile(null);
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const download = async (): Promise<void> => {
    if (!order?.final_file_url) return;
    const { data, error } = await supabase.storage
      .from("order-final-files")
      .createSignedUrl(order.final_file_url, 300);
    if (error || !data) {
      toast.error("Could not open the file.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <Dialog open={Boolean(order)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {order ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                {order.title}
                <Pill tone={statusTone(order.status)}>{order.status.replace("_", " ")}</Pill>
              </DialogTitle>
              <DialogDescription className="font-mono text-xs">{order.reference}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Student full name" value={order.student?.full_name} />
              <Field label="School" value={order.student?.school} />
              <Field label="Course" value={order.course_code} />
              <Field label="Phone number" value={order.student?.phone} />
              <Field label="Submission time" value={when(order.created_at)} />
              <Field label="Deadline" value={when(order.deadline)} />
              <Field label="Price" value={naira(order.amount)} />
              <Field label="Completed at" value={when(order.completed_at)} />
            </div>

            <div className="mt-2">
              <Field label="Assignment description" value={order.description} />
            </div>

            <div className="mt-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Uploaded student files
              </p>
              {files.length ? (
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {files.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">No files attached</p>
              )}
            </div>

            <div className="mt-4 space-y-3 rounded-lg border p-4">
              <div className="space-y-1.5">
                <Label htmlFor="final-file">Upload final file (PDF or Word)</Label>
                <Input
                  id="final-file"
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {order.final_file_name ? (
                  <button
                    type="button"
                    onClick={download}
                    className="text-xs text-primary underline underline-offset-4"
                  >
                    Current file: {order.final_file_name}
                  </button>
                ) : null}
              </div>
              <Button
                className="w-full"
                disabled={busy || (!file && !order.final_file_url)}
                onClick={() => complete.mutate()}
              >
                {busy ? "Saving…" : "Mark as Completed"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Marking as completed instantly moves the student's progress bar to 100% and shows
                their download button.
              </p>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
