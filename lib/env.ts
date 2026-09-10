/**
 * Acceso a variables de entorno. Falla pronto y con un mensaje claro
 * en vez de propagar `undefined` hasta una llamada a la API.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Cópiala de .env.example a .env.local.`,
    );
  }
  return value;
}

export const serverEnv = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get resendApiKey() {
    return required("RESEND_API_KEY");
  },
  get resendFrom() {
    return process.env.RESEND_FROM || "Rastro <onboarding@resend.dev>";
  },
  get appSecret() {
    return required("APP_SECRET");
  },
  get siteUrl() {
    return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  },

  // --- APIs de datos (Dia 2-3) ---
  get braveApiKey() {
    return required("BRAVE_API_KEY");
  },
  /** Opcional: sin clave, el informe marca las filtraciones como "no comprobadas". */
  get hibpApiKey(): string | undefined {
    return process.env.HIBP_API_KEY || undefined;
  },
  get perplexityApiKey() {
    return required("PERPLEXITY_API_KEY");
  },
  get anthropicApiKey() {
    return required("ANTHROPIC_API_KEY");
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
};

/**
 * URL absoluta para redirecciones. Nunca usar el origen de la peticion:
 * detras del tunel de Cloudflare la app ve "localhost:3000".
 */
export function absoluteUrl(path: string): URL {
  return new URL(path, serverEnv.siteUrl);
}
