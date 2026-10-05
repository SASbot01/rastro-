/** Especificacion OpenAPI 3.1 de la API publica. La pagina /api-docs se genera de aqui. */
export const API_SPEC = {
  openapi: "3.1.0",
  info: {
    title: "Rastro API",
    version: "2026-09-16",
    description:
      "API de Rastro (rastropro.com) para usar sus herramientas en tus proyectos: catálogo de sitios que publican datos personales con su trámite de baja, portales de rectificación de los proveedores de IA, redacción de cartas RGPD, análisis de mensajes sospechosos, cálculo de la puntuación de exposición y lectura de TUS propios informes. Nunca devuelve datos de terceros: los informes son solo de la cuenta dueña de la clave.",
    contact: { email: "hola@rastropro.com", url: "https://rastropro.com/soporte" },
  },
  servers: [{ url: "https://rastropro.com/api/v1" }],
  security: [{ bearer: [] }],
  components: { securitySchemes: { bearer: { type: "http", scheme: "bearer", description: "Clave `rk_live_...` creada en rastropro.com/cuenta → API." } } },
  paths: {
    "/sites": { get: { summary: "Catálogo de sitios que publican o venden datos personales", description: "26 sitios (brokers españoles, guías, buscadores de personas, redes) con contacto de privacidad, formulario de baja y pasos. Público (con clave).", parameters: [{ name: "kind", in: "query", schema: { type: "string", enum: ["broker", "people-search", "business-registry", "directory", "phonebook", "results"] } }, { name: "host", in: "query", description: "Filtra por dominio (coincidencia por sufijo).", schema: { type: "string" } }], responses: { 200: { description: "Lista de sitios" } } } },
    "/sites/{slug}": { get: { summary: "Ficha de un sitio", parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Sitio" }, 404: { description: "No existe" } } } },
    "/ai-providers": { get: { summary: "Portales de rectificación/supresión de los proveedores de IA", responses: { 200: { description: "OpenAI, Gemini, Perplexity, Meta, Microsoft" } } } },
    "/score/rules": { get: { summary: "Regla de la puntuación de exposición (0–100)", responses: { 200: { description: "Penalizaciones y umbrales del semáforo" } } } },
    "/score": { post: { summary: "Calcula la puntuación a partir de señales", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { breachesWithPassword: { type: "integer" }, breachesWithoutPassword: { type: "integer" }, publicProfiles: { type: "integer" }, aiKnowsEmployer: { type: "boolean" }, aiKnowsCity: { type: "boolean" }, contactDataPublic: { type: "boolean" }, aiFalseData: { type: "boolean" } } } } } }, responses: { 200: { description: "{ score, level, breakdown }" } } } },
    "/letters/draft": { post: { summary: "Redacta una carta de supresión RGPD (art. 17) o de rectificación a un proveedor de IA", description: "Devuelve asunto, cuerpo y el contacto de privacidad si el sitio está en el catálogo. No la envía.", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["fullName", "email", "url"], properties: { fullName: { type: "string" }, email: { type: "string", format: "email" }, city: { type: "string" }, url: { type: "string", format: "uri", description: "Página donde aparecen los datos" }, what: { type: "string", description: "Qué datos aparecen" }, locale: { type: "string", enum: ["es", "en"] } } } } } }, responses: { 200: { description: "{ subject, body, host, contact, known }" } } } },
    "/guardian": { post: { summary: "¿Es una estafa? Analiza un mensaje (usa IA; requiere Pro)", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["text"], properties: { text: { type: "string", maxLength: 4000 }, sender: { type: "string" }, locale: { type: "string", enum: ["es", "en"] }, personalize: { type: "boolean", description: "Usar el contexto de tu propio informe (cuentas, filtraciones)" } } } } } }, responses: { 200: { description: "{ verdict, confidence, headline, reasons, uses_your_data, actions, verify_how }" }, 402: { description: "Requiere Pro" } } } },
    "/me": { get: { summary: "Tu cuenta", responses: { 200: { description: "{ email, plan, monitoring, created_at }" } } } },
    "/me/reports": { get: { summary: "Tus informes (resumen)", responses: { 200: { description: "Lista con id, fecha, puntuación, nivel" } } } },
    "/me/reports/latest": { get: { summary: "Tu último informe completo", responses: { 200: { description: "score, summary, findings, actions, accounts, assistants" }, 404: { description: "Sin informes" } } } },
    "/me/letters": { get: { summary: "Tus cartas RGPD y su estado", responses: { 200: { description: "Lista" } } } },
    "/me/checks": { get: { summary: "Tus comprobaciones diarias de filtraciones (vigilancia)", parameters: [{ name: "days", in: "query", schema: { type: "integer", default: 30, maximum: 365 } }], responses: { 200: { description: "Lista por día" } } } },
  },
} as const;
