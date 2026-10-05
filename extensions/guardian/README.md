# Rastro Guardián — extensión (0.2.0)

Manifest V3 para Chrome/Edge, ES/EN. Dos funciones:

1. **Robot de cookies**: en cada web (http/https) aparece un robot arrastrable (3 modelos: Vigía, Cubo, Orbe; el cuerpo se tambalea al moverlo). Cuenta las cookies del sitio y de los terceros que carga, las clasifica (necesarias, medición, publicidad/redes, compraventa de datos), detecta publicidad **antes de aceptar**, cookies de años y sesiones mal protegidas, y pone una **nota 0–100**. Botones: «Rechazar por mí» (pulsa la opción más privada del aviso), «Guía de sitios», «Ocultar aquí».
2. **¿Te suena raro?** (de la 0.1): lleva un texto seleccionado al Guardián de rastropro.com.

## Probar

1. `chrome://extensions` → modo desarrollador → «Cargar descomprimida» → esta carpeta.
2. Abre cualquier web: el robot sale abajo a la derecha. Arrástralo; tócalo para ver el resumen. El icono de la extensión muestra la nota.

## Privacidad (comprobado por tests)

- **Ninguna llamada de red**: no hay `fetch`, `XMLHttpRequest`, `WebSocket` ni `sendBeacon` en la extensión. Todo se calcula en el navegador (`lib/analyze.js`).
- Solo se leen **metadatos** de las cookies (nombre, dominio, caducidad, banderas). Los valores no se leen, no se guardan ni se muestran.
- Permisos: `cookies` + acceso a sitios http/https (necesario para leer las cookies del sitio y dibujar el robot), `storage` (tu robot, su posición y los sitios ocultos), `activeTab`/`scripting`/`clipboardWrite` (función «¿Te suena raro?»). Sin historial, sin `webRequest`, sin pestañas en segundo plano.
- Los resúmenes se guardan en `storage.session` (se borran al cerrar el navegador).

## Código

- `lib/trackers.js` — dominios y nombres de cookies conocidos (empresa y categoría) y textos de «rechazar».
- `lib/analyze.js` — motor puro con nota y frases ES/EN (tests en `tests/cookies.test.mjs`).
- `mascot.js` — robots y física (script clásico, también se usa en rastropro.com/extension).
- `background.js` (service worker), `content.js`, `popup.*`.

`npm run ext:sync` copia el robot a la web y genera `public/extension/rastro-guardian.zip`.

## 0.3 — aviso de webs falsas y bloqueo

- `lib/phishing.js` + `lib/brands.js`: motor puro que compara el dominio con ~45 marcas suplantadas en España (imitaciones a una letra, letras de otros alfabetos y punycode, marca + palabra cebo, extensiones baratas) y dos señales de la página (¿pide contraseña?, ¿pide tarjeta?). Tests en `tests/phishing.test.mjs`, con lista de webs legítimas que NO deben disparar.
- El robot se pone en rojo y abre la burbuja solo: "Ir a la web oficial", "Salir de aquí", "Es de fiar" (lista local `trustedHosts`). Sale aunque el robot esté oculto en ese sitio.
- Bloqueo opcional (popup): `rules/trackers.json` se genera en `npm run ext:sync` desde `lib/trackers.js` (publicidad y comercio de datos, solo como tercero). Apagado por defecto.
- Prueba real: `EXTRA_FLAGS='--host-resolver-rules=MAP+bbva-clientes.com+127.0.0.1:8765' node scripts/test-extension.mjs http://bbva-clientes.com/` y `BLOCK=1 node scripts/test-extension.mjs <url>`.
