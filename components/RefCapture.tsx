"use client";

import { useEffect } from "react";

/**
 * Guarda el origen del trafico (?ref=ig, tiktok, li, yt...) para saber que
 * contenido trae informes. Solo una palabra corta en localStorage, 30 dias;
 * ningun identificador de persona. El formulario la envia con la solicitud.
 */
export const REF_KEY = "rastro_ref";
export const REF_RE = /^[a-z0-9_-]{1,24}$/i;

export function readRef(): string | null {
  try {
    const raw = localStorage.getItem(REF_KEY);
    if (!raw) return null;
    const { ref, at } = JSON.parse(raw) as { ref: string; at: number };
    if (Date.now() - at > 30 * 86_400_000 || !REF_RE.test(ref)) return null;
    return ref.toLowerCase();
  } catch {
    return null;
  }
}

export function RefCapture() {
  useEffect(() => {
    try {
      const p = new URLSearchParams(location.search);
      const ref = p.get("ref") ?? p.get("utm_source");
      if (ref && REF_RE.test(ref)) localStorage.setItem(REF_KEY, JSON.stringify({ ref: ref.toLowerCase(), at: Date.now() }));
    } catch {
      /* sin almacenamiento */
    }
  }, []);
  return null;
}
