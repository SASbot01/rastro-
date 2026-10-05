# Plan de crecimiento Rastro — 6 meses (22-09-2026 → 22-03-2027)

Objetivo doble: **10.000 seguidores en Instagram** y **50.000 € facturados en 6 meses** (≈ 8.300 €/mes al llegar al mes 6; el acumulado exige acelerar: 1k · 3k · 6k · 10k · 14k · 16k).

Quien lo lleva: Alejandro delante de la cámara y en las decisiones; Claude en estrategia, contenido, producto, datos y seguimiento. Claude no puede publicar, grabar ni responder mensajes en redes: lo prepara todo y Alejandro lo ejecuta en 30–45 minutos al día.

## 1. Los números, sin adornos

**Facturación.** 50k en 6 meses no salen solo de particulares a 19 €/mes.

| Vía | Objetivo mes 6 | Ingreso/mes | Cómo |
|---|---|---|---|
| Pro individual (19 €/mes o 99 €/año) | 250 suscriptores | ≈ 4.200 € | Redes → informe gratis → Pro |
| Familiar | 40 planes | ≈ 1.200 € | Upsell dentro de la app y en el correo |
| Equipos (149–299 €/mes) | 15 pymes | ≈ 3.000 € | LinkedIn + salida directa a gestorías, clínicas, despachos |
| Total | | **≈ 8.400 €/mes** | |

Embudo que hace falta para 250 Pro: con una conversión del 3 % de informe gratis a Pro, hacen falta ≈ 8.300 informes en 6 meses (≈ 45 al día). Un reel que funciona en este nicho trae entre 200 y 2.000 informes; hacen falta 4–6 reels "grandes" y 100+ normales. Es exigente pero no irreal.

**Seguidores.** 10.000 en 180 días son 55 al día. Con 5 reels a la semana y una tasa normal del nicho (1 de cada 8 supera 50k visualizaciones) se llega. Sin constancia, no.

**Regla de oro:** los seguidores no pagan; pagan los informes. Cada pieza de contenido termina en "hazte el informe gratis en el enlace".

## 2. Posicionamiento

**Alejandro** = el amigo que trabaja en ciberseguridad y te explica sin asustarte. No "hacker", no capucha (la capucha la lleva el muñeco). Persona real, tono tranquilo, siempre con el dato en pantalla.

**Frase:** *"Mira lo que la IA sabe de ti."* Subfrase: *"Y qué hacer para que sepa menos."*

**Enemigo:** las empresas que venden tus datos y las estafas que los usan. Nunca el usuario, nunca el miedo gratuito.

**Prueba que ofrecemos:** la nota 0–100, los datos retirados y comprobados, y la memoria de la IA. Nunca prometemos borrar.

**Ética de contenido:** solo se analiza a Alejandro, a voluntarios que firman consentimiento por escrito, o a figuras públicas usando exclusivamente lo que ya es público (y sin datos de contacto). Nunca "te analizo en directo" a un desconocido.

## 3. Motor de contenido (Instagram como principal, TikTok como copia, LinkedIn para empresas)

Cinco pilares, un reel de cada por semana:

1. **"Lo que la IA sabe de…"** (lunes). Un voluntario (amigo, seguidor con consentimiento) ve su informe por primera vez. La reacción es el contenido. Gancho: *"Le pregunté a ChatGPT por mi madre. Esto es lo que dijo."*
2. **Estafa de la semana** (martes). Un SMS o correo real que llegó. Se pega en el Guardián o se reenvía al bot de Telegram y el bot contesta en pantalla. Gancho: *"Este SMS de Correos es falso. Te enseño en 20 segundos cómo lo sé."*
3. **Reto / experimento** (miércoles). *"He buscado mi nombre en 11 sitios que venden datos. Apareció en 2. Les he pedido que lo quiten. Vuelvo en 30 días."* Serie con continuación: engancha.
4. **Truco de 30 segundos** (jueves). Una acción concreta del informe: cambiar contraseña filtrada, poner Strava en privado, rechazar cookies con el robot. Gancho: *"Si usas la misma contraseña desde 2019, mira esto."*
5. **Detrás de Rastro** (viernes). Alejandro construyendo el producto con IA, decisiones, números reales de la semana. Genera confianza y comunidad; es también el pilar de LinkedIn.

Formato: vertical 9:16, 15–35 s, la app real en pantalla (nunca mockups), subtítulos grandes, el muñeco al final con el enlace. Primer segundo siempre con la pantalla del informe o el mensaje de estafa, no con la cara.

Fines de semana: 1 carrusel (los ya hechos en `docs/marketing/`) y stories con encuesta ("¿te ha llegado este SMS?").

**Cadencia mínima:** 5 reels + 1 carrusel + stories diarias. Se graban en un bloque de 2 horas el domingo (5 reels) con los guiones que Claude entrega el viernes.

**Enlace en bio:** rastropro.com con parámetro `?ref=ig` (se añade al embudo de métricas) → informe gratis.

## 4. Embudo dentro del producto

- **Informe gratis → cuenta.** Ya existe. Meta: 70 % de los que piden informe lo ven (hoy sin datos reales; `/admin/metricas` lo dirá).
- **Correo tras el informe (día 1, 3, 7).** Tres correos automáticos: qué hacer primero; cómo retiramos datos y lo comprobamos; oferta Pro con el dato personal ("apareces en 2 sitios de venta de datos"). *Pendiente de construir: lib de secuencias sobre `daily`.*
- **Pro:** el botón debe decir para qué sirve hoy: "Que Rastro pida la retirada por mí y me avise si vuelve". La página `/pro` se reescribe alrededor de la promesa "medimos los datos retirados".
- **Precio de lanzamiento:** anual a 59 € los primeros 100 (código en los reels, caduca). El anual adelanta caja y fideliza; el mensual se queda a 19 €.
- **Familiar:** aparece justo tras la primera carta enviada ("¿y tus padres?").

## 5. Empresas (Rastro Equipos): donde está la mitad del dinero

Cliente: pymes de 10–50 personas sin informático, con datos sensibles y presión regulatoria: **gestorías, clínicas y dentistas, despachos de abogados, inmobiliarias, colegios concertados**. Argumento: NIS2 y el seguro de ciberriesgo piden pruebas; Rastro les da un informe mensual de exposición del equipo y de contraseñas filtradas.

Método (2 horas por semana de Alejandro):
- LinkedIn: 2 publicaciones a la semana (el pilar 5 adaptado + un caso anonimizado).
- 20 mensajes directos a la semana a gerentes de esos sectores en su ciudad, con un informe de exposición **de la empresa** (dominio: correos filtrados del dominio, perfiles, lo que dice la IA de la empresa) como regalo. *Pendiente: informe por dominio en `/equipos`.*
- 1 llamada de 20 minutos por cada respuesta. Oferta: primer mes gratis, 149 €/mes después.
- Alianza: una gestoría que lo ofrezca a sus clientes con 20 % de comisión.

Meta: 3 pymes en el mes 2, 15 en el mes 6.

## 6. Semana 1 (del 22 al 28 de septiembre): quitar los frenos

Nada de esto se puede saltar; sin ello el tráfico se pierde.

| Día | Alejandro | Claude |
|---|---|---|
| L | Abrir cuenta de desarrollador de Apple (99 $). Saldo OpenAI (5 $). Crear @rastropro en Instagram, TikTok y LinkedIn con el avatar y la bio | Reescribir `/pro` alrededor de "datos retirados"; parámetro `?ref=` en el embudo; secuencia de 3 correos |
| M | Configurar el webhook de Stripe (guía en TAREAS) y rotar las claves de API | Guiones de los 5 primeros reels + carrusel; informe por dominio (diseño) |
| X | Grabar los 5 reels con los guiones (2 h). Subir el zip a la Chrome Web Store | Editar el plan de 20 mensajes de LinkedIn con plantilla y lista de 50 pymes de tu ciudad |
| J | Publicar reel 1. 20 amigos prueban la app (el "20 personas") | Mirar `/admin/metricas` cada día y ajustar la portada donde caiga la gente |
| V | Publicar reel 2. Responder cada comentario y mensaje | Entregar guiones de la semana 2 y el resumen semanal con cifras |

Cada viernes Claude entrega: cifras de la semana (seguidores, informes, cuentas, Pro, ingresos), qué reel funcionó y por qué, guiones de la semana siguiente y una decisión para tomar.

## 7. Hitos y reglas de corte

| Día | Seguidores | Informes acumulados | Ingresos acumulados | Si no se llega |
|---|---|---|---|---|
| 30 | 800 | 600 | 1.000 € | Cambiar los ganchos: probar 3 formatos nuevos, no el producto |
| 60 | 2.500 | 2.000 | 4.000 € | Revisar la conversión a Pro: precio, promesa, correos |
| 90 | 4.500 | 4.000 | 10.000 € | Si Equipos está a 0, dedicar el 50 % del tiempo a salida directa B2B |
| 120 | 6.500 | 6.000 | 20.000 € | Meter publicidad pagada solo en el reel que mejor convierte (300 €/mes) |
| 180 | 10.000 | 8.300 | 50.000 € | |

Regla de decisión: cada dos semanas se mata la peor de las cinco series de reels y se sustituye por una variante de la mejor.

## 8. Producto al servicio del plan (orden de Claude)

1. `/pro` reescrita + código de lanzamiento + `?ref=` en métricas (semana 1).
2. Secuencia de correos post-informe (semana 1–2).
3. Informe de exposición por dominio para el argumento de Equipos (semana 2–3).
4. Botón "donar este mensaje" en el bot y el Guardián para mejorar la detección con casos reales (semana 3).
5. App de escritorio "guardián" (visión a 3 meses): solo cuando el embudo web convierta. Un producto instalable sin audiencia no vende.

## 9. Riesgos honestos

- **Constancia de grabación.** Es el riesgo número uno. Sin 5 reels a la semana no hay plan.
- **Un reel viral con un homónimo o un dato falso.** Solo voluntarios con consentimiento firmado; el informe siempre mostrando la ambigüedad.
- **Coste de API con picos.** Un reel viral pueden ser 2.000 informes en un día ≈ 100 €. Tener 300 € de margen y los límites por IP activos (ya corregidos).
- **Soporte.** A partir de 100 Pro, una hora al día de mensajes. Preparar respuestas tipo desde el mes 2.
- **Legal.** Responsable del tratamiento con nombre real en `/privacidad` antes del primer reel (variables `NEXT_PUBLIC_LEGAL_*`).
