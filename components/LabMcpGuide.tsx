import type { Messages } from "@/lib/i18n";

interface Tool { name: string; desc: string }
interface Group { label: string; tools: Tool[] }
interface McpGuide {
  title: string; intro: string; connectTitle: string; connectBody: string; keyNote: string;
  groupsTitle: string; examplesTitle: string; examples: string[]; groups: Group[];
}

/** Guía plegable dentro del Lab: todo lo que Claude puede hacer con el MCP de Rastro. */
export function LabMcpGuide({ messages }: { messages: Messages }) {
  const g = (messages.lab as unknown as { mcp?: McpGuide }).mcp;
  if (!g) return null;

  return (
    <details className="card group mt-4 p-0">
      <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-accent/12 text-accent" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]"><path d="M4 7l8-4 8 4-8 4-8-4zM4 7v10l8 4 8-4V7M12 11v10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span className="text-[15px] font-semibold text-ink">{g.title}</span>
        </span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-faint transition-transform group-open:rotate-180" aria-hidden="true"><path d="m5 8 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </summary>

      <div className="border-t border-line px-5 py-5">
        <p className="text-[14px] leading-relaxed text-muted">{g.intro}</p>

        <h3 className="mt-5 text-[12px] font-semibold uppercase tracking-[0.1em] text-faint">{g.connectTitle}</h3>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{g.connectBody}</p>
        <pre className="mt-2 overflow-x-auto rounded-[12px] bg-surface-2 p-3 text-[12px] leading-relaxed text-ink"><code>claude mcp add rastro --scope user --env RASTRO_API_KEY=rk_live_TU_CLAVE -- node mcp/rastro-mcp.mjs</code></pre>
        <p className="note mt-1.5">{g.keyNote}</p>

        <h3 className="mt-6 text-[12px] font-semibold uppercase tracking-[0.1em] text-faint">{g.groupsTitle}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {g.groups.map((group) => (
            <div key={group.label} className="tile p-4">
              <p className="text-[13px] font-semibold text-ink">{group.label}</p>
              <ul className="mt-2.5 grid gap-2.5">
                {group.tools.map((t) => (
                  <li key={t.name} className="text-[13px] leading-snug">
                    <code className="rounded bg-paper px-1.5 py-0.5 font-mono text-[11.5px] text-accent">{t.name}</code>
                    <span className="mt-1 block text-muted">{t.desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <h3 className="mt-6 text-[12px] font-semibold uppercase tracking-[0.1em] text-faint">{g.examplesTitle}</h3>
        <ul className="mt-2.5 grid gap-1.5">
          {g.examples.map((e, i) => (
            <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed text-muted"><span className="mt-px text-accent" aria-hidden="true">›</span>{e}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}
