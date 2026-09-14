"use client";

import { useEffect } from "react";

const VALID_THEMES = new Set(["ember", "verdant"]);

/**
 * Applies the equipped board theme (from the inventory) to <html data-theme>.
 * Clears the attribute when nothing (or an unknown item) is equipped.
 */
export function ThemeApplier({ equippedThemeSlug }: { equippedThemeSlug?: string | null }) {
  useEffect(() => {
    const root = document.documentElement;
    if (!root) return;
    if (equippedThemeSlug) {
      const slug = equippedThemeSlug.replace(/^theme-/, "");
      if (VALID_THEMES.has(slug)) {
        root.setAttribute("data-theme", slug);
        return;
      }
    }
    root.removeAttribute("data-theme");
  }, [equippedThemeSlug]);

  return null;
}
