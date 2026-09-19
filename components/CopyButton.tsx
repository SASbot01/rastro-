"use client";

import { useState } from "react";

/** Copia un texto al portapapeles; sin dependencias. */
export function CopyButton({ text, label, doneLabel }: { text: string; label: string; doneLabel: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      // Sin permiso de portapapeles: el usuario puede seleccionar el texto a mano.
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="btn btn-primary"
    >
      {done ? doneLabel : label}
    </button>
  );
}
