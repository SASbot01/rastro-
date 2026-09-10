"use client";

/** Burbuja junto al muneco de la portada: abre el chat flotante (AskRastro). */
export function AskBubble({ label, question, className = "" }: { label: string; question?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("rastro:ask", { detail: question }))}
      className={"group inline-flex items-center gap-2 rounded-full border border-accent bg-surface px-4 py-2 text-[13.5px] font-semibold text-ink shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition-transform hover:scale-[1.03] " + className}
    >
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
      {label}
    </button>
  );
}
