"use client";

import { useState } from "react";
import { translator, type Messages } from "@/lib/i18n";

type State = "idle" | "busy";

/**
 * Compartir la puntuacion como imagen (CLAUDE.md s.4.4). En movil usa la
 * hoja nativa (Web Share API con fichero); si no esta disponible, abre la
 * imagen para guardarla. Nunca comparte el enlace del informe completo.
 */
export function ShareButton({ requestId, score, messages }: { requestId: string; score: number; messages: Messages }) {
  const tr = translator(messages);
  const [state, setState] = useState<State>("idle");
  const imageUrl = `/informe/${requestId}/imagen?f=story`;

  async function share() {
    if (state === "busy") return;
    setState("busy");
    try {
      const blob = await (await fetch(imageUrl)).blob();
      const file = new File([blob], "rastro.png", { type: "image/png" });
      const payload = { files: [file], title: tr("share.title"), text: tr("share.text", { score }) };
      if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
        await navigator.share(payload);
        return;
      }
      window.open(imageUrl, "_blank", "noopener");
    } catch (error) {
      // Cancelar la hoja de compartir lanza AbortError: no es un fallo.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        window.open(imageUrl, "_blank", "noopener");
      }
    } finally {
      setState("idle");
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={share}
          disabled={state === "busy"}
          className="inline-flex items-center gap-2 rounded-[10px] bg-accent px-5 py-3 text-[15px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
            <path d="M10 3v9M6.5 6.5 10 3l3.5 3.5M4 11v4a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {state === "busy" ? tr("share.sharing") : tr("share.button")}
        </button>
        <a
          href={imageUrl}
          download="rastro.png"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-[10px] border border-line bg-surface px-4 py-3 text-[14px] font-medium text-ink hover:border-faint"
        >
          {tr("share.download")}
        </a>
      </div>
      <p className="px-1 text-[12px] leading-relaxed text-faint">{tr("share.note")}</p>
    </div>
  );
}
