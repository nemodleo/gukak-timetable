"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** ← / → move to the previous / next day. Ignored while typing in a field. */
export function DayKeyNav({ prev, next }: { prev: string; next: string }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      )
        return;
      if (e.key === "ArrowLeft") router.push(`/day/${prev}`);
      else if (e.key === "ArrowRight") router.push(`/day/${next}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, router]);
  return null;
}
