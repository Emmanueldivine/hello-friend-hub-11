import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import "@/student.css";

export type SpTheme = "light" | "dark" | "contrast";
export const SP_THEMES: { value: SpTheme; label: string }[] = [
  { value: "light", label: "Bright" },
  { value: "dark", label: "Midnight Ink" },
  { value: "contrast", label: "High contrast" },
];

const CACHE_KEY = "uh_theme";
const isTheme = (v: unknown): v is SpTheme => v === "light" || v === "dark" || v === "contrast";

const Ctx = createContext<{ theme: SpTheme; setTheme: (t: SpTheme) => void }>({ theme: "light", setTheme: () => {} });
export const useSpTheme = () => useContext(Ctx);

/** The theme choice is saved on the student's account in the database.
 *  The browser only keeps a copy of this one value so the page does not flash on load. */
export function SpThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<SpTheme>("light");

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (isTheme(cached)) setThemeState(cached);
    supabase.auth.getUser().then(({ data }) => {
      const saved = data.user?.user_metadata?.["theme"];
      if (isTheme(saved)) {
        setThemeState(saved);
        localStorage.setItem(CACHE_KEY, saved);
      }
    });
  }, []);

  const setTheme = useCallback((t: SpTheme) => {
    setThemeState(t);
    localStorage.setItem(CACHE_KEY, t);
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) supabase.auth.updateUser({ data: { theme: t } }).catch(() => {});
    });
  }, []);

  return (
    <Ctx.Provider value={{ theme, setTheme }}>
      <div className="sp" data-sp-theme={theme}>
        {children}
      </div>
    </Ctx.Provider>
  );
}
