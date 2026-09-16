# Rastro Guardián — extensión MVP (0.1.0)

Extensión Manifest V3 para Chrome/Edge, ES/EN. No está publicada en las tiendas ni instalada automáticamente. Esta primera versión captura una selección **tras pulsar el botón**, permite editarla y, con otra acción explícita, la copia y abre el Guardián existente. El análisis lo inicia la persona en la web con su sesión habitual.

## Probar

1. Abre `chrome://extensions` (o `edge://extensions`). Activa modo desarrollador.
2. «Cargar descomprimida» → selecciona esta carpeta `extensions/guardian`.
3. Selecciona texto en una página HTTP(S), abre la extensión y pulsa «Usar el texto seleccionado».
4. Revisa/elimina datos sensibles, pulsa «Copiar y abrir Guardián» y pega el texto en la web.
5. Pulsa Analizar en Rastro. El endpoint existente mantiene sus límites y control de sesión.

## Permisos y límites

- `activeTab` y `scripting`: leer solo `window.getSelection()` de la pestaña que autorizaste al abrir la extensión. No hay permisos sobre todos los sitios ni scripts persistentes.
- `clipboardWrite`: copia voluntaria. El portapapeles del sistema puede conservarla después de cerrar la extensión; vaciar el campo **no** borra el portapapeles.
- Sin claves, backend, almacenamiento, cookies, historial, analítica ni monitorización del buzón.
- Un máximo de 4.000 caracteres. Chrome protege sus páginas internas y algunas vistas PDF: pegar manualmente en esos casos.
- No detecta automáticamente phishing ni presencia en brokers. Esas integraciones requieren una fase posterior y consentimiento independiente.

Pendiente: revisión interactiva en Chrome/Edge, iconos de tienda, ficha de privacidad y publicación. No se presenta como extensión verificada ni como detector automático.
