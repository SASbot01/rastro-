# Publicar Rastro Guardián en la Chrome Web Store (y Edge)

Por qué hace falta: ningún navegador permite instalar una extensión "desde una web" con un clic. Chrome eliminó esa opción (inline install) en 2018. La única forma de que **todo el mundo** la instale aceptando los permisos es publicarla en la tienda oficial. Desde la ficha, el botón "Añadir a Chrome" muestra el diálogo de permisos y listo.

Todo lo de esta carpeta está preparado para subirlo tal cual. Tiempo estimado: 30 minutos + revisión de Google (normalmente 1–3 días).

## 1. Cuenta de desarrollador (una sola vez, 5 $)

1. Entra en https://chrome.google.com/webstore/devconsole con la cuenta de Google de Rastro.
2. Acepta el acuerdo de desarrollador y paga la tasa única de 5 $.
3. En "Cuenta" rellena el correo de contacto (el de privacidad de Rastro) y verifícalo. Sin esto no deja publicar.

## 2. Subir el paquete

- Archivo: `public/extension/rastro-guardian.zip` (se regenera con `npm run ext:sync`). Versión actual: **0.3.0**.
- "Nuevo elemento" → arrastra el zip. Debe reconocer nombre, versión e iconos del `manifest.json`.

## 3. Ficha de la tienda (pegar)

**Nombre:** Rastro Guardián — aviso de webs falsas y cookies

**Descripción corta (≤ 132 caracteres):**
ES: `Te avisa si una web imita a tu banco, resume las cookies de cada sitio y bloquea rastreadores. Todo en tu navegador.`
EN: `Warns you when a site imitates your bank, sums up each site's cookies and blocks trackers. All inside your browser.`

**Descripción larga:**

ES:
```
Rastro Guardián vive en tu navegador. En cada web que abres, un pequeño personaje (puedes elegir entre 4) revisa las cookies y te lo cuenta en lenguaje llano:

• Aviso en rojo si la web imita a un banco, a Correos, a la DGT o a Hacienda, con enlace a la oficial.
• Nota de privacidad del 0 al 100, también en el icono de la barra.
• Bloqueo opcional de publicidad que te sigue y de empresas que comercian con perfiles.
• Cuántas cookies son necesarias, de medición o de publicidad, y de qué empresas.
• Aviso si te rastrean antes de aceptar, si hay empresas que compran y venden perfiles o cookies que duran años.
• «Rechazar por mí»: pulsa la opción más privada del aviso de cookies.
• Si la web vende datos y está en nuestro catálogo, te lleva a pedir la retirada (rastropro.com/sitios).

Privacidad de verdad: la extensión no tiene conexión con ningún servidor. Solo lee metadatos de cookies (nombre, dominio, caducidad), nunca su valor, y no toca tu historial ni el contenido de las páginas. No hace falta cuenta.

Arrastra al robot por la pantalla: la cabeza va contigo y el cuerpo se tambalea. Tócalo para ver el resumen. «Ocultar aquí» lo quita de las webs donde no lo quieras.

Hecha por Rastro (rastropro.com), la app que te enseña qué sabe la IA de ti.
```

EN:
```
Rastro Guardián lives in your browser. On every site you open, a small character (pick one of 4) reviews the cookies and explains them in plain language:

• Red warning when the site imitates a bank, a courier or a tax agency, with a link to the official one.
• Privacy score from 0 to 100, also on the toolbar icon.
• Optional blocking of ads that follow you and companies that trade in profiles.
• How many cookies are necessary, analytics or advertising, and which companies set them.
• Warnings if you're tracked before consenting, if data brokers are present or if cookies last for years.
• "Reject for me": clicks the most private option of the cookie banner.
• If the site trades data and is in our catalog, it takes you to request removal (rastropro.com/sitios).

Real privacy: the extension has no connection to any server. It reads cookie metadata only (name, domain, expiry), never values, and never touches your history or page content. No account needed.

Drag the robot around: the head follows you and the body wobbles. Tap it to see the summary. "Hide here" removes it from sites where you don't want it.

Made by Rastro (rastropro.com), the app that shows you what AI knows about you.
```

**Categoría:** Privacidad y seguridad (si no aparece, "Herramientas").
**Idioma:** Español (añadir Inglés como segundo idioma con los textos EN).
**Sitio web oficial:** https://rastropro.com/extension
**URL de soporte:** https://rastropro.com/como-funciona (y el correo de contacto de Rastro).
**Política de privacidad:** https://rastropro.com/extension/privacidad

## 4. Imágenes (en esta carpeta)

| Uso | Archivo | Tamaño |
|---|---|---|
| Icono de la tienda | `icon-store-128.png` | 128×128 |
| Capturas (mín. 1, máx. 5) | `shot-phishing.png` (la primera), `shot-xataka.png`, `shot-marca.png`, `shot-elmundo.png` | 1280×800 |
| Mosaico promocional pequeño | `promo-small-440x280.png` | 440×280 |
| Mosaico marquesina (opcional) | `promo-marquee-1400x560.png` | 1400×560 |

## 5. Pestaña "Prácticas de privacidad" (respuestas exactas)

**Finalidad única:** "Proteger la privacidad y la seguridad del usuario en el sitio que visita: avisar si el dominio imita a una marca conocida, resumir las cookies y rastreadores con una nota de privacidad, y permitir rechazarlos o bloquearlos."

**Justificación de permisos:**
- `cookies`: "Leer los metadatos (nombre, dominio, caducidad, flags) de las cookies del sitio activo para contarlas y clasificarlas. Nunca se leen valores."
- `storage`: "Guardar el personaje elegido, su posición, los sitios donde el usuario lo ha ocultado y el resumen de la pestaña actual (storage.session)."
- `declarativeNetRequestWithHostAccess`: "Bloqueo opcional de rastreadores de publicidad con un conjunto de reglas estáticas incluido en el paquete (rules/trackers.json). Viene desactivado; el usuario lo activa desde el popup. La extensión no ve el tráfico."
- Permiso de host `http://*/*`, `https://*/*`: "El resumen debe funcionar en cualquier web que el usuario abra; el script de contenido dibuja el personaje y detecta el aviso de cookies en la página."
- ¿Usa código remoto? **No.**

**Uso de datos:** marcar que la extensión **no recopila ni transmite** ningún dato del usuario. Certificar los tres puntos (no venta, no uso ajeno a la finalidad, no uso para solvencia/préstamos).

## 6. Visibilidad y publicación

- Visibilidad: **Pública**. Regiones: todas.
- "Enviar a revisión". Google suele tardar 1–3 días. Si piden algo, casi siempre es la justificación del permiso de host: copiar la de arriba.
- Cuando esté aprobada, copia la URL de la ficha (`https://chromewebstore.google.com/detail/…`) y ponla en el servidor:

```
NEXT_PUBLIC_CHROME_STORE_URL=https://chromewebstore.google.com/detail/XXXXXXXX
```

Con eso `/extension` cambia solo: botón grande "Añadir a Chrome" con los 3 pasos, y desaparece la instalación manual.

## 7. Microsoft Edge Add-ons (gratis, mismo zip)

1. https://partner.microsoft.com/dashboard/microsoftedge → registro gratuito.
2. "Crear nueva extensión" → subir el mismo zip → mismos textos e imágenes.
3. Al aprobarla: `NEXT_PUBLIC_EDGE_STORE_URL=https://microsoftedge.microsoft.com/addons/detail/…`

Los usuarios de Edge también pueden instalar desde la Chrome Web Store directamente; el enlace propio es solo por confianza.

## 8. Actualizaciones futuras

Subir versión en `extensions/guardian/manifest.json`, `npm run ext:sync`, subir el zip nuevo en la consola → "Enviar a revisión". Los usuarios la reciben solos.
