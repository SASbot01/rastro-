import { getMessages, translator, type Locale } from "@/lib/i18n";
import type { GuardianVerdict } from "@/lib/ai/guardian";

/**
 * Bot de Telegram del Guardian: la persona reenvia el mensaje sospechoso al bot
 * y recibe el veredicto alli mismo, donde llega la estafa. Privacidad: no se
 * guarda ni el mensaje ni el identificador del chat (solo un hash para el
 * limite diario). Sin TELEGRAM_BOT_TOKEN el bot no existe y el webhook da 404.
 */
const API = "https://api.telegram.org";

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET);
}

export async function sendTelegram(chatId: number, text: string): Promise<void> {
  try {
    const res = await fetch(`${API}/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000), link_preview_options: { is_disabled: true } }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!res.ok) console.warn("[telegram] sendMessage", res.status);
  } catch (e) {
    console.warn("[telegram] sendMessage fallo:", String(e).slice(0, 120));
  }
}

export async function sendTyping(chatId: number): Promise<void> {
  await fetch(`${API}/bot${process.env.TELEGRAM_BOT_TOKEN}/sendChatAction`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chatId, action: "typing" }), signal: AbortSignal.timeout(5_000), cache: "no-store" }).catch(() => undefined);
}

/** Veredicto en texto plano (Telegram sin formato: nada que escapar, nada que se rompa). */
export function formatVerdict(v: GuardianVerdict, locale: Locale): string {
  const tr = translator(getMessages(locale));
  const icon = v.verdict === "scam" ? "🔴" : v.verdict === "suspicious" ? "🟠" : "🟢";
  const lines = [`${icon} ${tr(`telegram.verdict.${v.verdict}`)} (${v.confidence}%)`, v.headline, "", tr("telegram.why"), ...v.reasons.slice(0, 4).map((r) => `• ${r}`), "", tr("telegram.what"), ...v.actions.slice(0, 4).map((a) => `• ${a}`)];
  if (v.verify_how) lines.push("", tr("telegram.verify"), v.verify_how);
  lines.push("", tr("telegram.foot"));
  return lines.join("\n");
}
