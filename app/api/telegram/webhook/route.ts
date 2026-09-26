import { NextResponse } from "next/server";
import { after } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { analyzeMessage } from "@/lib/ai/guardian";
import { allowByKey } from "@/lib/rate-limit";
import { getMessages, translator, type Locale } from "@/lib/i18n";
import { formatVerdict, sendTelegram, sendTyping, telegramConfigured } from "@/lib/telegram";
import { track } from "@/lib/events";

/**
 * Webhook del bot de Telegram (Guardian). Telegram llama aqui con cada mensaje.
 * Seguridad: solo se acepta si trae el secreto que pusimos al registrar el
 * webhook (cabecera X-Telegram-Bot-Api-Secret-Token). Se responde 200 al
 * instante y el analisis corre despues: Telegram reintenta si tardamos.
 * No se guarda el mensaje ni quien lo envia.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

interface TgMessage {
  chat?: { id: number; type?: string };
  from?: { language_code?: string };
  text?: string;
  caption?: string;
  forward_origin?: { type?: string; sender_user_name?: string; sender_user?: { first_name?: string; username?: string }; chat?: { title?: string }; sender_chat?: { title?: string } };
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function senderOf(m: TgMessage): string | null {
  const o = m.forward_origin;
  if (!o) return null;
  return o.sender_user_name ?? o.sender_user?.username ?? o.sender_user?.first_name ?? o.chat?.title ?? o.sender_chat?.title ?? null;
}

export async function POST(request: Request) {
  if (!telegramConfigured()) return new NextResponse(null, { status: 404 });
  const secret = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!safeEqual(secret, process.env.TELEGRAM_WEBHOOK_SECRET!)) return new NextResponse(null, { status: 401 });

  const update = (await request.json().catch(() => null)) as { message?: TgMessage } | null;
  const msg = update?.message;
  const chatId = msg?.chat?.id;
  // Solo chats privados: en grupos el bot leeria mensajes de terceros.
  if (!msg || typeof chatId !== "number" || (msg.chat?.type && msg.chat.type !== "private")) return NextResponse.json({ ok: true });

  const locale: Locale = msg.from?.language_code?.startsWith("es") || !msg.from?.language_code ? "es" : "en";
  const tr = translator(getMessages(locale));
  const text = (msg.text ?? msg.caption ?? "").trim();

  after(async () => {
    if (!text) return sendTelegram(chatId, tr("telegram.onlyText"));
    if (text.startsWith("/")) {
      const cmd = text.split(/[\s@]/)[0].toLowerCase();
      return sendTelegram(chatId, tr(cmd === "/privacidad" || cmd === "/privacy" ? "telegram.privacy" : "telegram.start"));
    }
    if (text.length < 10) return sendTelegram(chatId, tr("telegram.tooShort"));
    if (!(await allowByKey(`tg:${chatId}`, "guardian"))) return sendTelegram(chatId, tr("telegram.limit"));

    void sendTyping(chatId);
    void track("guardian_used", { locale, props: { channel: "telegram", forwarded: Boolean(msg.forward_origin) } });
    const result = await analyzeMessage({ locale, text: text.slice(0, 4000), sender: senderOf(msg), context: null });
    await sendTelegram(chatId, result.ok ? formatVerdict(result.verdict, locale) : tr("telegram.error"));
  });
  return NextResponse.json({ ok: true });
}
