# Rastro — estudio de utilidad y mercado (13-09-2026)

Nota de partida: **6,5 / 10 hoy**, con un techo claro de **8,5–9** si se cierran cuatro huecos concretos (abajo). El problema es real y va a más; la solución está bien planteada pero todavía "enseña" más de lo que "resuelve", y el precio no está justificado del todo con lo que hay hoy.

## 1. Notas por dimensión

| Dimensión | Nota | Por qué |
|---|---|---|
| Problema / dolor | **9** | 489.248 ciberdelitos en España en 2025 (+5,3 %), el 88 % estafas; la suplantación de identidad está en el 33 % de los fraudes; INCIBE atendió 142.767 consultas en su 017 (+45 %). La gente ya sufre el problema, aunque no sepa nombrarlo. |
| Momento (timing) | **9** | "¿Qué sabe la IA de mí?" es una pregunta nueva que nadie responde. El mercado de borrado de datos pasa de 0,45 B$ (2025) a 0,6 B$ (2026) y proyecta 11,5 B$ en 2036 (34 % anual). Incogni factura 20–40 M$ creciendo 20–25 %/año. |
| Hueco de mercado en España | **8** | "Spain has almost no native data broker opt-out service": los brokers que dominan (Axesor/Experian, eInforma, Infocif, Dateas) no los cubre ningún servicio americano. Nadie ofrece esto en español con la vía AEPD. |
| Solución tal como está hoy | **6** | El informe es bueno y claro (score, hallazgos, IA, acciones). Pero Rastro **prepara** cartas; Incogni/DeleteMe **las envían y persiguen** por ti. Para el usuario medio "yo lo hago" es fricción. |
| Diferenciación | **7,5** | Tres cosas únicas: la parte de IA, la puntuación compartible y el idioma/legal español. Una debilidad: Google "Resultados sobre ti" ya avisa gratis si tu teléfono/dirección aparece en el buscador. |
| Calidad del dato | **6** | HIBP es la referencia; Brave + Perplexity + Claude dan buenos resultados con ciudad/profesión, pero con nombres comunes sigue habiendo homónimos. Solo se consulta un asistente de IA (Perplexity), no ChatGPT/Gemini directamente. |
| Monetización | **5** | 19 €/mes contra 7,99 $ (Incogni) y 8,71 $ (DeleteMe). Lo que justifica el sobreprecio (IA + cartas + AEPD + escáner Gmail) todavía exige trabajo del usuario. Falta plan familiar y un anual más agresivo. |
| Distribución | **4** | Sin tráfico aún. El motor (nota compartible + reels con la mascota) es correcto, pero no está probado. Analítica recién puesta. |
| Confianza / legal | **6** | Falta el nombre del responsable en la política, la app de Google sin verificar (aviso "no verificada"), y sin sello ni prensa. Para un producto de privacidad, la confianza es el producto. |
| Robustez técnica | **7,5** | Pipeline con reintentos, caché, cron de reparación, vigilancia diaria y mensual, límites, borrado a 30 días. Falta copia de seguridad y alertas de caída. |

**Media ponderada: 6,5.** Utilidad para quien lo usa hoy: 7. Preparación para vender a escala: 5,5.

## 2. Qué le falta al mercado (y Rastro puede ocupar)

1. **Un servicio español de verdad.** Los americanos no tocan Axesor, eInforma, Infocif, Dateas ni las páginas de "guías" y directorios locales. Quien cubra bien esos 20–30 sitios con su procedimiento exacto de baja gana el mercado ibérico. Hoy Rastro los detecta pero no tiene un catálogo con el formulario/correo exacto de cada uno.
2. **La capa de IA.** Nadie te dice qué responde ChatGPT, Gemini o Perplexity cuando preguntan por ti, ni te ayuda a rectificarlo. Es el titular de Rastro y hay que hacerlo más profundo: consultar varios asistentes, mostrar la respuesta literal, y ofrecer el trámite de rectificación en OpenAI/Google (existe, casi nadie lo conoce).
3. **Traducción a lenguaje de persona.** Puntuación 0–100, "qué se ve, por qué importa, qué hacer". Google e Incogni son herramientas; Rastro es una explicación. Eso vende en redes y lo debe cuidar.
4. **La vía legal española sin abogado.** Cartas art. 17 + plazo + reclamación AEPD es un flujo que nadie ha empaquetado para consumidores. Falta cerrarlo con seguimiento real (¿contestaron?, ¿qué contestaron?, subir la respuesta, siguiente paso).

## 3. Qué le falta a Rastro para ser un 9

Por orden de impacto / esfuerzo:

1. **Que Rastro envíe y persiga las cartas** (no solo las redacte). Envío desde un buzón de Rastro en nombre del usuario (con su autorización), registro de acuse, recordatorio automático al día 25, segunda carta, y escrito AEPD listo con las pruebas. Esto es lo que compra la gente por 8 €/mes en Incogni; con esto, 19 € se sostiene. *Esfuerzo: 1–2 semanas.*
2. **Catálogo español de sitios con datos** (30 sitios: Axesor, eInforma, Infocif, Dateas, Páginas Blancas/Amarillas, Informa, Empresite, Guiaempresas, Cylex, Yelp, Infobel, Nomesconoces… y clasificaciones deportivas, BOE/boletines). Para cada uno: dónde aparece, contacto de privacidad verificado, plantilla exacta, tiempo medio de respuesta. *1 semana. Es contenido, no código.*
3. **IA en profundidad**: preguntar a 2–3 asistentes (Perplexity + ChatGPT/Gemini vía API), mostrar la respuesta literal en el informe, botón "pedir rectificación" con el formulario oficial de OpenAI/Google. *1 semana.*
4. **Pruebas de resultado**: captura "antes" del sitio y captura "después" cuando la carta funciona; el usuario ve que su nota sube por algo que hizo Rastro. Es el momento "wow" que se comparte. *3–4 días.*
5. **Precio**: dejar Pro en 19 €/mes solo cuando (1) esté hecho; mientras, **9,99 €/mes · 79 €/año** con la anualidad como opción por defecto, y **plan familiar** (3 personas) a 14,99 €. Un plan gratuito con vigilancia diaria de filtraciones (barata) engancha y luego vende. *1 día.*
6. **Confianza**: responsable legal con nombre, página "cómo lo hacemos" con las fuentes, verificación de Google, y 2–3 menciones en prensa/creadores. *Tuyo, no de código.*
7. **Homónimos**: pedir siempre ciudad (no opcional) y un dato más (empresa o centro de estudios); reduce el 80 % de los falsos positivos. *1 día.*

## 4. Riesgos que hay que vigilar

- **Google gratis**: "Resultados sobre ti" cubre teléfono/dirección en Google sin pagar. Rastro no debe venderse como "quitar tus datos de Google"; se vende como *todo lo demás* (IA, brokers, filtraciones, legal).
- **Incogni entrando en España** con un plan multi-región a 7,99 $: si mejora la cobertura local, el precio de Rastro tiene que apoyarse en la IA y en lo legal, no en el borrado.
- **Escala de la IA**: cada informe cuesta dinero y el gratis es el gancho. Con miles de informes al mes el coste sube; la caché de 30 días y un "informe ligero" gratis (sin Perplexity) pueden hacer falta.
- **Falsos positivos**: un informe que te atribuye el perfil de otro destruye la confianza. Mejor un hallazgo menos que uno equivocado.

## 5. Veredicto

- **Utilidad hoy: 7/10.** Cualquier persona saca algo útil del informe gratis en dos minutos; eso ya vale.
- **Producto vendible hoy: 5,5/10.** Pro promete más de lo que ejecuta por ti; el precio es alto para lo que exige del usuario.
- **Mercado: 8,5/10.** Problema creciente, categoría en expansión, hueco español real, ángulo de IA sin competencia.
- **Potencial con los puntos 1–5 hechos: 8,5–9/10**, y con una tesis clara: *el único servicio en español que te enseña lo que la IA y los buscadores saben de ti y reclama por ti, con la ley española en la mano.*

## Fuentes

- Incogni, [The best data broker removal services 2026](https://blog.incogni.com/essential-data-removal-tools/) · CyberInsider, [Incogni vs DeleteMe 2026](https://cyberinsider.com/data-removal/incogni-vs-deleteme/) · Security.org, [Best data removal services 2026](https://www.security.org/data-removal/best/) · Cybernews, [Optery vs DeleteMe vs Incogni](https://cybernews.com/privacy-tools/optery-vs-deleteme-vs-incogni/)
- Privacy Insight Solutions, [Best data broker removal in Europe](https://privacyinsightsolutions.com/blog/best-data-broker-removal-service-europe) (brokers españoles sin cobertura)
- Fact.MR, [Personal Data Removal Services Market 2036](https://www.factmr.com/report/personal-data-removal-services-market) · Muuver, [Incogni (ingresos estimados)](https://muuver.com/acquisition/incogni/) · Cybernews, [Incogni review 2026](https://cybernews.com/privacy-tools/incogni-review/)
- Infobae, [Google permite eliminar datos privados de los resultados](https://www.infobae.com/tecno/2026/02/11/google-ahora-permite-a-los-usuarios-eliminar-datos-privados-de-si-mismos-en-los-resultados-de-busqueda/) · Infobae, [La herramienta de Google que avisa si tu información ha sido expuesta](https://www.infobae.com/tecno/2026/07/30/la-herramienta-de-google-que-te-avisa-si-tu-informacion-personal-ha-sido-expuesta-en-internet-y-como-eliminarla/) · WeLiveSecurity, [Cómo eliminar tus datos de Google](https://www.welivesecurity.com/es/privacidad/como-eliminar-datos-personales-resultados-busqueda-google/)
- Digital Perito, [Estafas online +125 % en España](https://digitalperito.es/blog/estafas-online-espana-125-por-ciento-aumento-ciberfraude-2026/) · Moncloa.com, [INCIBE y la estafa que usa tu nombre y DNI](https://www.moncloa.com/2026/03/06/incibe-phishing-suplantacion-3364525/) · La Moncloa, [Medidas contra estafas por teléfono y SMS](https://www.lamoncloa.gob.es/serviciosdeprensa/notasprensa/transformacion-digital-y-funcion-publica/paginas/2025/estafas-telefonicas-y-sms.aspx)


## Actualización 13-09-2026 (tras el bloque "de 6,5 a 9")

| Dimensión | Antes | Ahora | Qué cambió |
|---|---|---|---|
| Solución tal como está | 6 | **8,5** | Rastro envía y persigue las cartas (recordatorio, respuesta, pruebas, AEPD), comprueba si sigues ahí; catálogo español con trámites; v2 simulador y v3 guardián ya en producción. |
| Calidad del dato | 6 | **7,5** (9 con claves) | Ciudad obligatoria; ChatGPT y Gemini además de Perplexity (falta poner las claves); respuesta literal de cada IA. |
| Monetización | 5 | **7** | Plan familiar y precios configurables listos; falta decidir precio y crear los enlaces en Stripe. |
| Distribución | 4 | **6** | 26 páginas SEO "cómo borrar mis datos de X", sitemap/robots, guardián gratis como puerta de entrada. Falta tráfico real y analítica activada. |
| Confianza / legal | 6 | **7,5** | /como-funciona con fuentes y regla de puntuación; falta el nombre legal y la verificación de Google. |
| Robustez | 7,5 | **9** | Copias diarias, health, watchdog, deploy que arranca pm2. Falta `pm2 startup` (sudo) y copia fuera del servidor. |

**Media: 6,5 → 8.** Lo que separa del 9 está en manos del propietario (claves, Stripe, `pm2 startup`, nombre legal, analítica) y del mercado (tráfico).
