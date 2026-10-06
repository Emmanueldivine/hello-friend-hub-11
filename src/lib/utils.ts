import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Short order number shown to students and admins, e.g. UH-111288. */
export function shortRef(ref: string | null | undefined) {
  const s = String(ref ?? "").replace(/^UH-?/i, "").replace(/^UH/i, "");
  return s.length > 6 ? `UH-${s.slice(-6)}` : String(ref ?? "");
}
