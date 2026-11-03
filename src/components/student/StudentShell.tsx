import type { ReactNode } from "react";

/** Shared student look: navy + gold, matching the original portal. */
export const studentTheme = {
  navy: "#0a1931",
  yellow: "#ffd700",
  paper: "#f8fafc",
  line: "#e2e8f0",
};

export function StudentShell({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: studentTheme.paper, color: studentTheme.navy, fontFamily: 'Poppins,"Segoe UI",Roboto,Arial,sans-serif' }}>
      <header style={{ background: studentTheme.navy, color: "#fff", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ fontSize: 18 }}>
          Uni<span style={{ color: studentTheme.yellow }}>everyhelp</span>
        </strong>
        {right}
      </header>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: 18 }}>{children}</main>
    </div>
  );
}

export const btnStyle = {
  border: 0,
  borderRadius: 12,
  background: studentTheme.yellow,
  color: studentTheme.navy,
  fontWeight: 700,
  padding: "0.8rem 1rem",
  cursor: "pointer",
  width: "100%",
} as const;

export const inputStyle = {
  width: "100%",
  padding: "0.75rem",
  borderRadius: 10,
  border: `1px solid ${studentTheme.line}`,
  fontSize: 16,
  boxSizing: "border-box",
} as const;
