"use client";
import { useEffect } from "react";
const key = (themeId: string) => `trace-theme-scroll:${themeId}`;
export function rememberThemeScroll(themeId: string) {
  try {
    sessionStorage.setItem(key(themeId), String(window.scrollY));
  } catch {
    /* Optional UI memory. */
  }
}
export function useThemeScroll(themeId: string) {
  useEffect(() => {
    let frame = 0;
    try {
      const value = Number(sessionStorage.getItem(key(themeId)));
      if (Number.isFinite(value) && value > 0)
        frame = requestAnimationFrame(() => window.scrollTo(0, value));
    } catch {
      /* Scrolling still works when session storage is unavailable. */
    }
    return () => cancelAnimationFrame(frame);
  }, [themeId]);
}
