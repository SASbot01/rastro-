# Rastro — de v1 a v5, propósito y brief de UX/UI para Astra

Versión 16-09-2026. Todo lo descrito está en producción en https://rastropro.com salvo lo marcado como *idea*.

---

## 1. Propósito

**Rastro te enseña lo que internet y la inteligencia artificial saben de ti, y te da los medios para reducirlo.**

- Pregunta que responde: *«¿Qué sabe la IA de mí?»* Nadie la respondía en español, en dos minutos y gratis.
- Tesis: cualquier desconocido, y ahora cualquier asistente de IA, puede saber más de ti que tú mismo. Rastro es el **espejo**: lo que ven de ti, en una nota del 0 al 100, en lenguaje de persona normal. Y después, las **herramientas** para reclamar con la ley en la mano.
- Lo que nunca prometemos: borrar. Lo que sí: **ver, entender, reclamar y vigilar.**
- Cliente: personas normales (no técnicas), en móvil, que llegan por redes. Después, sus familias y sus empresas.
- Modelo: informe gratis (gancho + viralidad por la nota compartible) → Pro 19 €/mes · 99 €/año → Familiar → Equipos (B2B).

## 2. Qué hace cada versión

### v1 — El informe (gratis)
Nombre + correo + ciudad (+ profesión) → código de 6 dígitos → en 1–2 minutos: **puntuación 0–100** con semáforo, resumen llano, hallazgos en 4 categorías (Filtraciones · Lo que dice la IA · Perfiles y páginas públicas · Datos posiblemente falsos), cuentas conocidas, 3 acciones, e **imagen compartible** (story y cuadrada) con la nota y el nombre tapado.
Fuentes: Have I Been Pwned (filtraciones + volcados), Brave (buscador), Perplexity (y ChatGPT/Gemini si hay clave), Gravatar; redacción con Claude; puntuación por regla fija y auditable.

### v1.5 — Cuenta y Pro
Cuenta sin contraseña (código o Google). **Vigilancia**: cada día se mira el correo en filtraciones nuevas (aviso solo si hay algo); cada mes se rehace el informe y se avisa solo si cambia; calendario y racha en el perfil. **Cartas RGPD (art. 17) enviadas por Rastro** desde `cartas@rastropro.com` en tu nombre, con recordatorio automático al día 20, registro de la respuesta del sitio, cronología como prueba, comprobación "¿sigue ahí?" y **reclamación a la AEPD** con todas las pruebas. **Escáner de Gmail** (beta): en qué servicios estás registrado y desde cuándo. **Catálogo de 26 sitios** (Dateas, Axesor, eInforma, Infobel, Páginas Blancas, ZabaSearch, Spokeo, Radaris, Strava, LinkedIn…) con contacto y trámite exacto, publicado como guía SEO en `/sitios`. Plan **familiar** (titular + 2). Panel de inicio con gráficas (dónde pierdes puntos, evolución, guía con casillas). Muñeco-asistente que responde dudas en toda la web.

### v2 — Simulador de ataque personal (`/simulador`)
Con tu propio informe, la IA te enseña **cómo te engañarían**: 3 mensajes de phishing a tu medida (con el pretexto que los hace creíbles y las pistas para descubrirlos), la **llamada de estafa** (guion + señales + cómo colgar) y una nota de **"facilidad para engañarte"** con las 3 defensas que más te protegen. Pro: enviarte los mensajes a tu propio correo para vivirlo, regenerar con cada informe, imagen compartible «así me engañarían».

### v3 — Guardián (`/guardian`)
Pegas un SMS, correo o WhatsApp sospechoso y te dice **si es estafa, por qué, qué datos tuyos usa y qué hacer**. Con cuenta, lo cruza con tu informe (sabe en qué sitios tienes cuenta y qué se filtró: detecta estafas dirigidas). Gratis 5 al día; Pro sin límite. No guarda el mensaje.

### v4 — Identidad frente a la IA
Desde el informe, **"Pedir rectificación con Rastro"** a ChatGPT/OpenAI, Gemini/Google, Perplexity, Meta AI y Copilot: carta (arts. 16 y 17 RGPD) con la respuesta literal como prueba y los pasos del portal de derechos de cada uno; se envía por Rastro donde aceptan correo. **Imágenes con tu nombre** (`/imagenes`): las fotos que devuelve un buscador con tu nombre y ciudad, con carta de retirada al sitio (derecho a la propia imagen) y enlace a Google Imágenes.

### v5 — Rastro Equipos (`/equipos`, `/equipo`)
B2B para pymes: cada empleado tiene su Pro completo; la empresa tiene un panel con **puntuación media, cuántos tienen contraseñas filtradas, quién tiene informe y vigilancia**, invitaciones por correo, altas/bajas y CSV. **Privacidad por diseño**: la empresa solo ve la puntuación de quien decide compartirla; nunca hallazgos ni datos. Precios orientativos 149 €/mes (10) y 299 €/mes (25).

### Infra y confianza
Servidor propio + Cloudflare; copias diarias; health + watchdog; página `/como-funciona` (fuentes, qué guardamos, regla de la puntuación, seguridad); todo bilingüe ES/EN.

## 3. Mapa de pantallas (para diseñar)

| Ruta | Qué es | Quién |
|---|---|---|
| `/` sin sesión | Portada comercial: hero + mascota, "así se ve tu informe", quiénes somos, cómo funciona, FAQ, formulario | Todos |
| `/` con sesión | **Panel**: puntuación grande, delta, accesos rápidos, donut "dónde pierdes puntos", barras de evolución, hallazgos principales, guía con casillas, chips para preguntar al muñeco | Cuenta |
| `/verify`, `/entrar` | Código de 6 dígitos / Google | Todos |
| `/informe` · `/informe/[id]` | Lista de informes · Informe (ring de puntuación fijo + acordeones por categoría; "Lo que responde cada IA"; cuentas conocidas; botones de carta) | Cuenta |
| `/herramientas` | Hub: simulador, imágenes, guardián, vigilancia, escáner Gmail, cartas y plazos | Cuenta |
| `/cartas/[id]` · `/reclamacion` | Carta: destinatario, trámite conocido, texto, enviar por Rastro, respuesta, ¿sigue ahí?, cronología · Escrito AEPD | Pro |
| `/simulador` · `/guardian` · `/imagenes` | v2 · v3 · v4 | Cuenta / Pro |
| `/cuenta` | Perfil: avatar con radar si vigila, stats, vigilancia (tira semanal + calendario), plan (familiar/equipo), soporte | Cuenta |
| `/pro` · `/equipos` · `/equipo` | Precios · Landing B2B · Panel de empresa | Todos / Titular |
| `/sitios` · `/sitios/[slug]` · `/como-funciona` · `/soporte` | Guías públicas SEO · Confianza · Soporte | Todos |

## 4. Sistema visual actual

- Fondo `#0a0a0a`, tarjetas `#151515`, campos `#1d1d1d`, líneas `#262626`; texto `#f4f4f2` / `#a3a39e` / `#6f6f6a`; **acento verde `#4dfc5f`** (único), ámbar `#ffb020`, rojo `#ff5f5f`.
- Inter en todo; esquinas grandes (20–28 px); un solo acento; nada de calaveras ni estética hacker.
- **Logo**: la "R" verde de dos trazos. **Mascota**: el muñeco con capucha, pasamontañas y gorra con la R, ojos verdes: el "vigilante amable". Habla en la web (chat flotante) y en los vídeos.
- Componentes propios: anillo de puntuación, donut de motivos, barras de evolución, tira semanal Lun–Dom, calendario mensual, acordeones `<details>`, pastillas de estado, tarjetas de teléfono con capturas reales, imagen OG.
- Navegación: barra inferior en móvil (Inicio · Informe · Herramientas · Perfil), barra lateral en escritorio.

## 5. Ideas brutales de UX/UI (para Astra)

Ordenadas por impacto. Cada una cabe en una o dos pantallas.

1. **El informe como revelación, no como PDF.** Al terminar, en vez de saltar a la página, una secuencia de 20 segundos: pantalla negra → la mascota mira → "Hemos buscado en 4 sitios" → los contadores suben (5 filtraciones · 3 perfiles · 2 sitios que venden tus datos) → el anillo se dibuja hasta tu nota con un golpe de color → "Ver qué hemos encontrado". Con sonido opcional. Es lo que la gente graba y sube.
2. **Modo espejo.** Un botón "Verme como me ve un desconocido": Rastro reconstruye tu "ficha" tal como la ensamblaría un estafador (foto pública, ciudad, empleo, cuentas, rutas, familiares deducidos) en una tarjeta estilo expediente. Es el "existe un expediente sobre ti" hecho pantalla. Compartible con los datos tapados.
3. **Informe en formato stories.** Versión vertical con swipe (una tarjeta por hallazgo, barra de progreso arriba, "qué se ve / por qué importa / qué hacer" en tres pantallas). Los acordeones se quedan para escritorio.
4. **Lo que dice la IA, en formato chat.** La sección "Lo que responde cada IA" como conversación: burbuja "¿Quién es Ana?" → burbuja de ChatGPT, de Gemini, de Perplexity, con avatar de cada uno y un botón "Esto es falso" que abre la carta de rectificación. Se entiende al instante.
5. **Mapa de dónde apareces.** Mapa de España (o del mundo) con puntos: cada sitio que te lista, cada foto, cada ciudad que la IA cree que es la tuya. Tocar un punto abre el hallazgo. Sirve de portada del informe en escritorio.
6. **Antes / después con confeti.** Cuando una carta funciona ("ya no apareces"), pantalla de celebración: captura antes tachada, captura después, "+6 puntos", confeti verde y botón de compartir. La gente comparte victorias, no problemas.
7. **Misiones y racha.** La guía de pasos como misiones con recompensa visible: "Cambia la contraseña de LinkedIn → +15 puntos". Racha de vigilancia con niveles (Bronce/Plata/Oro), sin infantilizar: sobrio, tipo Duolingo para adultos.
8. **Percentiles y comparación anónima.** "Estás mejor que el 62 % de las enfermeras de Valencia que han usado Rastro" (mínimo 50 personas por grupo, anónimo). Da contexto a la nota y es viral.
9. **Modo pánico.** Botón rojo fijo "Me acaban de estafar / me han hackeado": flujo de 5 pasos guiado (bloquear tarjeta, cambiar contraseñas por orden, denunciar en 017/Policía con los datos precargados, avisar contactos, vigilancia activada). Puede ser la puerta de entrada de mucha gente.
10. **Empty states con la mascota.** Cada pantalla vacía (sin informe, sin cartas, sin imágenes) con el muñeco en una pose distinta y una frase corta. Cero pantallas mudas.
11. **Micro-interacciones.** Anillo que respira al cargar; pastillas que entran escalonadas; el radar del avatar cuando vigila; vibración corta en móvil al llegar un hallazgo nuevo; skeletons en verde apagado; "tirar para actualizar" en el panel.
12. **Modo claro opcional** para captura/impresión y accesibilidad (contraste AA en ambos), tamaño de fuente dinámico, VoiceOver etiquetado.
13. **Onboarding de 3 pantallas** para nuevos: "Te enseñamos lo que se ve de ti · Solo sobre ti · Se borra a los 30 días si no quieres cuenta", con la mascota, antes del formulario.
14. **Widget y pantalla de bloqueo**: nota actual + racha + última alerta (iOS/Android) cuando exista app.

## 6. Nuevas aplicaciones e implementaciones (siguiente año)

1. **App nativa (iOS/Android)** con notificaciones push (filtración nueva, respuesta a una carta, plazo vencido), widget de puntuación, Face ID, compartir directo a stories. Base: Expo/React Native reutilizando la API actual.
2. **Extensión de navegador "Guardián"**: aviso en Gmail/Outlook web cuando un correo es phishing dirigido (usa tu informe), aviso al entrar en un sitio que vende tus datos ("Aquí apareces tú, pedir retirada"), y un botón "¿Es una estafa?" en cualquier página.
3. **Bot de WhatsApp / Telegram**: reenvías el mensaje sospechoso y responde el veredicto del guardián en segundos. Es donde llegan las estafas; hay que estar ahí.
4. **Alias de correo (Rastro Mail)**: un alias por servicio (`amazon.ana@rastro.email`) que reenvía a tu correo; si se filtra, sabes quién fue y lo apagas. Es la defensa más potente para "cuentas conocidas" y crea dependencia del producto.
5. **Agente que actúa solo (v6)**: con permiso, rellena él mismo los formularios de baja (Spokeo, Whitepages, Dateas…) con un navegador automatizado, adjunta las capturas y te lo cuenta; renueva las solicitudes cada 90 días. Es el "Incogni" dentro de Rastro.
6. **Informe familiar**: una pantalla con los de casa (pareja, hijos mayores, padres) y sus notas, y alertas cuando uno cae. Los padres son compradores.
7. **Rastro para Equipos, nivel 2**: simulaciones de phishing programadas a toda la plantilla (con consentimiento), informe trimestral de "riesgo humano" en PDF, integración con Google Workspace/Microsoft 365 para altas automáticas, SSO.
8. **API pública** para aseguradoras, bancos y gestorías: "puntuación de exposición" como dato de onboarding (con consentimiento del usuario).
9. **Kiosco/QR para eventos y charlas**: escaneas, metes tu correo, y al acabar la charla tienes el informe. Herramienta de ventas para el fundador en colegios, empresas y ferias.
10. **Monitorización de voz/cara (cuando haya proveedor con consentimiento verificado)**: detectar deepfakes con tu cara o voz en redes y preparar la retirada.

## 7. Brief listo para pegar a Astra

> Eres el diseñador/a de producto de Rastro (rastropro.com), una app web móvil-first en español e inglés que enseña a personas normales lo que internet y la IA saben de ellas (nota 0–100), y les da herramientas para reclamar (cartas RGPD enviadas por nosotros, reclamación AEPD), vigilar (diaria y mensual), entrenarse (simulador de estafas a medida, guardián "¿es una estafa?") y proteger su identidad frente a la IA (rectificación en ChatGPT/Gemini/Meta, imágenes con su nombre). También tiene plan familiar y Rastro Equipos (panel para empresas con privacidad por diseño).
> Estética obligatoria: oscura, fondo #0a0a0a, tarjetas #151515, Inter, esquinas grandes, un solo acento verde #4dfc5f (semáforo verde/ámbar/rojo), sin calaveras ni estética hacker; logo "R" verde y mascota "vigilante amable" (muñeco con capucha y ojos verdes). Tono: cercano, claro, nunca alarmista, nunca vendedor. Regla de oro de cada hallazgo: qué se ve, por qué importa, qué hacer.
> Pantallas a rediseñar por prioridad: (1) la revelación del informe al terminar la espera, (2) el informe en móvil como stories y en escritorio con mapa, (3) el panel de inicio, (4) "lo que dice cada IA" en formato chat con botón "esto es falso", (5) la carta con su cronología y el antes/después, (6) simulador y guardián, (7) perfil con vigilancia (racha, calendario), (8) panel de empresa. Entrega: sistema de componentes (tokens, tipografía, estados, empty states con la mascota, micro-interacciones descritas), flujos en móvil 390×844 y escritorio 1280, y prototipo navegable. Cada pantalla debe poder capturarse y compartirse en redes sin mostrar datos personales.

---

Documentos relacionados: `docs/BIBLIA-RASTRO.md` (marketing), `docs/ESTUDIO-MERCADO.md` (mercado), `TAREAS.md` (pendientes), `CLAUDE.md` (técnico).
