"use client";

import { useState } from "react";
import { translator, type Messages } from "@/lib/i18n";

export function AppearanceToggle({ messages, initialTheme }: { messages: Messages; initialTheme: "dark" | "light" }) {
  const [theme, setTheme] = useState(initialTheme);
  const tr = translator(messages);
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    // A device preference, never report data. Cookie also keeps SSR consistent.
    document.cookie = `rastro_theme=${next};path=/;max-age=31536000;samesite=lax`;
    setTheme(next);
  }
  return <button className="ex-theme-toggle" onClick={toggle} title={tr("experience.theme")} aria-label={tr(theme === "dark" ? "experience.themeLight" : "experience.themeDark")}><span aria-hidden="true">{theme === "dark" ? "☼" : "◐"}</span></button>;
}
