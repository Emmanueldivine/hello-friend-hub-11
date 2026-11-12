import { useEffect, useRef, type ReactNode } from "react";

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", esc);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4" style={{ background: "rgba(0,0,0,.6)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="sp-card max-h-[90vh] w-full max-w-md overflow-y-auto p-6" style={{ boxShadow: "0 30px 80px rgba(0,0,0,.5)" }}>
        {children}
      </div>
    </div>
  );
}
