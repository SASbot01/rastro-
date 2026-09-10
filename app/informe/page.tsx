import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Pestana "Informe": lleva al ultimo informe de la cuenta. Sin sesion o sin
 * informes, al formulario de la portada.
 */
export default async function ReportIndexPage() {
  const session = await getSession();
  const user = session ? await findUserByEmail(session.email) : null;
  if (!user) redirect("/#form");

  const { data } = await supabaseAdmin()
    .from("requests")
    .select("id")
    .eq("user_id", user.id)
    .in("status", ["done", "processing", "verified"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  redirect(data ? `/informe/${data.id}` : "/#form");
}
