import { z } from "zod";
import { LOCALES } from "@/lib/i18n";

/**
 * Las claves de error son rutas del diccionario (messages/*.json).
 * El cliente las traduce; el servidor nunca devuelve texto ya traducido.
 */
export const requestSchema = z.object({
  firstName: z.string().trim().min(1, "formErrors.firstName").max(80, "formErrors.firstName"),
  lastName: z.string().trim().min(1, "formErrors.lastName").max(120, "formErrors.lastName"),
  email: z.email("formErrors.email").trim().toLowerCase().max(254, "formErrors.email"),
  city: z.string().trim().min(2, "formErrors.city").max(120, "formErrors.city"),
  occupation: z.string().trim().max(120).optional().or(z.literal("")),
  consent: z.literal(true, { error: "formErrors.consent" }),
  locale: z.enum(LOCALES).default("es"),
  /** Origen del trafico (?ref=ig). Una palabra corta; nada personal. */
  ref: z.string().trim().regex(/^[a-z0-9_-]{1,24}$/i).optional().or(z.literal("")),
});

export type RequestInput = z.infer<typeof requestSchema>;

/** Aplana los errores de zod a { campo: "clave.de.diccionario" }. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (!out[field]) out[field] = issue.message;
  }
  return out;
}
