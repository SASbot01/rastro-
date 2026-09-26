# Rastro · experiencia de producto y siguientes aplicaciones

Entrega del 16-09-2026. Rama `codex/rastro-experience`, basada en `cf01583`.

## Qué se ha implementado

| Área | Implementación | Dónde revisarla |
| --- | --- | --- |
| Informe | Resumen, fuentes, misiones y puntuación; conserva el informe detallado y sus acciones reales | `/informe/[id]`, `/demo` |
| Revelación | Modal de tres escenas, contadores derivados del informe, anillo animado, salto y Escape; activada al terminar el polling | «Ver revelación» en `/demo` |
| Stories | Tres pasos por hallazgo: qué se ve, por qué importa, qué hacer; swipe horizontal, flechas y botones | Stories |
| Espejo | Ficha basada en hallazgos existentes, con aviso de atribución y sin inferencias nuevas | Modo espejo |
| IA | Respuesta literal por proveedor, fecha, fuentes, rectificación con el endpoint existente y portales externos | Lo que dice la IA |
| Captura | Vista sin nombre, hallazgos ni fuentes; oculta también cabecera, avatar y chat; exporta PNG 1080 × 1920 sin datos personales | Preparar captura |
| Panel real | Anillo, prioridad al informe, guía con progreso local y aclaración sobre puntuación, donut sin desbordarse con penalizaciones superiores a 100 | `/` con sesión |
| Cartas | Cronología en la cabecera y resultado antes/última comprobación solo cuando existe un resultado negativo registrado | `/cartas/[id]`, demo Carta |
| Guardián | Ejemplo voluntario, contador, borrar mensaje y resultado, acceso a ayuda urgente | `/guardian` |
| Ayuda urgente | Cinco pasos según pago, cuenta o mensaje; banco, accesos, evidencias, ayuda/denuncia y seguimiento | `/ayuda-urgente` |
| Vigilancia | Racha consecutiva real: huecos, errores y alertas la interrumpen; etiquetas accesibles | `/cuenta` |
| Equipos | Vigilancia oculta sin consentimiento también en CSV; explicación de visibilidad; CSV sin fórmulas activas | `/equipo` |
| Tema | Oscuro por defecto, claro opcional persistido por cookie; impresión, foco y movimiento reducido | Botón de apariencia |
| Demo | Siete pantallas ES/EN sin base de datos ni proveedores; datos identificados como ficticios | `/demo` |
| Extensión | Manifest V3, selección voluntaria, revisión, copiar y abrir Guardián; sin acceso persistente a sitios | `extensions/guardian` |
| PWA | Accesos directos localizados a Guardián, informe y ayuda urgente | Manifest de la web |
| Onboarding | Tres pasos antes del formulario, saltable y recordado por dispositivo | `/#form` sin sesión |

No hay migraciones de base de datos, claves nuevas ni dependencias nuevas de ejecución.

## Sistema de componentes

`app/experience.css` extiende los tokens existentes. Fondo `#0a0a0a`, tarjetas `#151515`, campos `#1d1d1d`, Inter, acento `#4dfc5f`; estados ámbar y rojo. El texto auxiliar se ha elevado a `#999993` para mejorar legibilidad. Tema claro con verde oscuro `#166b26` y colores de estado más oscuros.

- `ScoreRing`: valor y etiqueta accesible; trazo de entrada de 1,6 s.
- `ReportExperience`: vistas y captura; `ReportView` conserva como hijo el informe completo del servidor.
- `ReportReveal`: diálogo nativo con foco, Escape y restauración; escena cada 6,5 s, cierre manual; con movimiento reducido solo avanza por acción de la persona. Sin audio automático.
- `ReportStories`: ritmo manual; teclado y tacto; el scroll vertical no dispara cambios de story.
- `EmptyState`: mascota existente, explicación y siguiente acción.
- `LetterJourney`: eventos reales y resultado de la última comprobación, sin capturas de prueba inventadas.
- `AppearanceToggle`: preferencia aplicada también en el HTML del servidor para evitar inconsistencias de hidratación.
- `GuideChecklist`: progreso local, foco visible y sin promesa de recuperar puntos.

La estructura cambia de dos columnas a una, y de cuatro métricas a dos. Referencias de revisión: móvil 390 × 844 y escritorio 1280 px. La demo es código navegable, no un archivo de Figma.

## Flujos para revisar

1. `/demo` → revelación → resumen → Stories → avanzar/retroceder/deslizar → finalizar.
2. Resumen → mapa de fuentes → hallazgo correspondiente. Se usan fuentes; **no se dibujan posiciones geográficas** porque el modelo actual no aporta coordenadas fiables.
3. Espejo → preparar captura → descargar imagen → volver. El contenido personal deja de renderizarse en la vista de captura; no se trata de un mecanismo de autorización ni de cifrado.
4. IA → rectificación: en la demo solo se explica; en informe propio con Pro se prepara mediante `/api/ai-requests`. El envío sigue ocurriendo en el flujo de carta existente.
5. Demo Carta → cronología y comprobación. En producción no se celebra como retirada global que una búsqueda deje de encontrar un nombre.
6. Guardián → ejemplo → analizar voluntariamente → limpiar. Ayuda urgente funciona sin cuenta ni proveedores.
7. Equipo → los datos no compartidos muestran «—». El CSV aplica el mismo control.

## Correcciones de privacidad y fiabilidad

- El estado de informe exige sesión propietaria antes de revelar el estado o marcar un trabajo como agotado.
- La página consulta solicitudes por ID **y correo de la sesión**, antes de cargar resultados privados.
- La vigilancia de un empleado no se muestra ni agrega cuando no aceptó compartir.
- CSV citado y neutralizado contra fórmulas de hoja de cálculo; respuesta privada sin caché.
- Las nuevas vistas enlazan solo a URLs HTTP(S) sin credenciales.
- Avisos informativos y proveedores no consultados no se cuentan como descubrimientos.
- El polling no solapa peticiones y tiene timeout por petición.
- El simulador público no inicializa Supabase antes de necesitar una cuenta.
- La antigüedad en el escáner se mide a la fecha del escaneo, sin cambiar durante un render.
- Los enlaces «nuevo informe» del panel vuelven a tener un formulario real en `/#form` con sesión.

## Ideas que requieren otra fase

| Aplicación | Próxima entrega concreta | Dependencias y límites |
| --- | --- | --- |
| App Expo iOS/Android | Inicio, informe, Guardián y enlace a cartas; contrato API documentado antes del cliente | Sesiones móviles revocables, APNs/FCM, credenciales de tiendas, consentimiento para notificaciones; no reutilizar cookies como tokens de larga duración |
| Extensión avanzada | Envío directo y aviso contextual a petición del usuario | Sesión de extensión revocable y scope limitado; sin lectura silenciosa del buzón; revisión de Chrome/Edge |
| Telegram/WhatsApp | Reenvío → explicación → abrir Guardián | Tokens del bot/cuenta Meta, consentimiento y vinculación de identidad; política explícita sobre copias que conservan esas plataformas |
| Rastro Mail | Crear/desactivar alias y detectar el alias filtrado | Dominio de correo, MX, proveedor de reenvío, SPF/DKIM/DMARC, límites antiabuso y política de retención |
| Agente de retirada | Un sitio del catálogo, modo borrador, prueba y aprobación por solicitud | Automatización aislada, condiciones del sitio, gestión de errores y CAPTCHA; ningún envío autónomo sin autorización explícita |
| Familiar | Invitación y agregados opt-in por adulto | Consentimiento individual; no consultar a hijos, pareja o padres en nombre de otra persona |
| Equipos 2 | Campaña consentida y reporte agregado | Aprobación de la empresa y participantes, dominios propios de simulación, controles de envío; SSO requiere integración de identidad |
| API pública | Contrato OpenAPI + grants revocables + auditoría | Finalidad, consentimiento y revisión legal, especialmente si la puntuación influye en crédito, seguros o contratación |
| Kiosco de eventos | QR al formulario, campaña y fecha de caducidad | No mostrar resultados ni correos en pantalla compartida; métricas sin datos personales |
| Detección de deepfakes | Evaluación de proveedor y consentimiento biométrico | No implementada: no hay proveedor validado ni umbrales de calidad definidos |

Tampoco se han inventado percentiles, capturas de antes/después, recompensas de puntuación ni niveles basados en datos inexistentes. Los percentiles requieren grupos reales de al menos 50 personas y revisión de riesgo de reidentificación.

## Validación y límites

`npm test`: reglas de puntuación, rachas con huecos/errores, consentimiento, CSV, fuentes seguras, captura anónima y paridad ES/EN. `npm run test:smoke`: rutas de demo, idiomas, tema en SSR, privacidad sin sesión y manifest. `npm run lint` y `npx tsc --noEmit`.

Build de producción: `npm run build -- --webpack`. En este Mac Turbopack encontró restricciones al abrir su proceso auxiliar; Webpack compiló correctamente. Google Fonts requiere red durante el build, igual que en la versión original. Node 22.6+ para los tests con eliminación de tipos (probados con Node 24).

No hay navegador conectado a la sesión de trabajo: queda pendiente comprobar visualmente 390 × 844 y 1280, VoiceOver, el swipe, la descarga de imagen y Chrome/Edge. Los flujos autenticados y proveedores se deben probar con una cuenta de ensayo autorizada antes de publicar. No se han enviado correos, cartas, simulaciones ni pagos para probar.

El servidor `100.114.169.107` se ha inspeccionado por SSH con el usuario `s4sf`: instalación `/home/s4sf/rastro`, misma base `cf01583`, y health con DB correcto. No se ha desplegado esta rama ni modificado otros proyectos.

Fuente de la guía urgente: [INCIBE, reporte de fraude](https://www.incibe.es/ciudadania/ayuda/reporte-de-fraude), consultada el 16-09-2026. El 017 es orientación; no se presenta como sustituto de una denuncia policial.
