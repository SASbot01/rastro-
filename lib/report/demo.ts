import type { ReportData } from "@/components/ReportView";
import { getMessages, translator, type Locale } from "@/lib/i18n";

/** No real identity, service breach claim, query or request ID is used in the demo. */
export function demoReport(locale: Locale): ReportData {
  const tr = translator(getMessages(locale));
  return {
    score: 62, generator: "template", created_at: "2026-09-16T10:00:00.000Z", summary: tr("experience.demoSummary"),
    findings: [
      { category: "breaches", severity: "high", title: tr("experience.demoFinding1"), detail: tr("experience.demoDetail1"), source_url: "https://service.example" },
      { category: "profiles", severity: "medium", title: tr("experience.demoFinding2"), detail: tr("experience.demoDetail2"), source_url: "https://profile.example" },
      { category: "false", severity: "medium", title: tr("experience.demoFinding3"), detail: tr("experience.demoDetail3"), source_url: null },
      { category: "ai", severity: "medium", title: tr("experience.demoFinding4"), detail: tr("experience.demoDetail4"), source_url: "https://profile.example" },
    ],
    actions: [1,2,3].map((n) => ({ title: tr(`experience.demoAction${n}`), detail: tr(`experience.demoActionDetail${n}`) })),
    assistants: ["openai", "gemini", "perplexity"].map((provider) => ({ provider: provider as "openai" | "gemini" | "perplexity", answer: tr("experience.demoAnswer"), status: "ok", sources: [{ title: "Example", url: "https://profile.example" }] })),
  };
}
