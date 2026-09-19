"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALES, LOCALE_COOKIE, translator, type Locale, type Messages } from "@/lib/i18n";

const ONE_YEAR = 60 * 60 * 24 * 365;

export function LocaleSwitcher({
  current,
  messages,
}: {
  current: Locale;
  messages: Messages;
}) {
  const tr = translator(messages);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(locale: Locale) {
    if (locale === current) return;
    // eslint-disable-next-line react-hooks/immutability -- browser cookie API in an event handler
    document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=${ONE_YEAR};samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div
      role="group"
      aria-label={tr("locale.switchTo")}
      className="flex items-center rounded-full border border-line bg-surface-2 p-[2px] data-[pending]:opacity-60"
      data-pending={pending || undefined}
    >
      {LOCALES.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            onClick={() => choose(locale)}
            aria-current={active ? "true" : undefined}
            className={
              "min-h-[40px] min-w-[38px] rounded-full px-2.5 text-[12px] font-semibold uppercase tracking-wide transition-colors " +
              (active ? "bg-ink text-paper" : "text-muted hover:text-ink")
            }
          >
            {locale}
          </button>
        );
      })}
    </div>
  );
}
