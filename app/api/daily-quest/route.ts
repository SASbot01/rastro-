import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase";
import { madridDay, completeToday } from "@/lib/daily-quest-core";
import { track } from "@/lib/events";

/**
 * Marca el reto de privacidad de hoy como hecho y actualiza la racha de la cuenta.
 * Lo llama el componente DailyQuest por fetch; devuelve el nuevo estado en JSON.
 */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await findUserByEmail(session.email);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const today = madridDay(new Date());
  const r = completeToday(user.quest_streak ?? 0, user.quest_best ?? 0, user.quest_last, today);
  if (!r.already) {
    const { error } = await supabaseAdmin()
      .from("users")
      .update({ quest_streak: r.streak, quest_best: r.best, quest_last: r.last })
      .eq("id", user.id);
    if (error) {
      console.error("[/api/daily-quest] fallo:", error.message);
      return NextResponse.json({ error: "server" }, { status: 500 });
    }
    void track("quest_done", { subject: user.id });
  }
  return NextResponse.json({ streak: r.streak, best: r.best, doneToday: true, already: r.already });
}
