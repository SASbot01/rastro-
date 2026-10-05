# Prompt para añadir el Centinela de Rastro en helm (el CRM)

Pega el bloque de abajo en Claude Code **abierto en el repositorio de helm** (no en el de Rastro). Antes, en Rastro:

1. Entra en **rastropro.com/cuenta → API** con la cuenta **titular de Rastro Equipos** (plan de empresa).
2. Crea una clave. Copia el `rk_live_...` (solo se enseña una vez).
3. En helm, guárdala como variable de entorno **`RASTRO_SENTINEL_KEY`** (en tu `.env` / secretos del servidor, nunca en el código).

> Importante: esta clave es la del **titular** de Equipos. Si no es una cuenta de empresa, el endpoint responde 403. La clave se puede revocar cuando quieras desde la misma pantalla.

---

## PROMPT (copia desde aquí)

```
Quiero conectar esta app (un CRM llamado helm) con el "Centinela" de Rastro: enviar eventos de seguridad a una API externa para que avise al responsable si pasa algo crítico. No cambies el comportamiento de la app; solo añade envíos de eventos en segundo plano.

API destino (ya existe, no la toques):
- POST https://rastropro.com/api/v1/sentinel
- Cabecera: Authorization: Bearer <valor de la env RASTRO_SENTINEL_KEY>
- Content-Type: application/json
- Cuerpo JSON: { kind, severity, source, actor, ip, country, message, meta }
  - kind (obligatorio, string): login_failed | login_new_country | export_bulk | admin_added | password_changed | other
  - severity: "info" | "warn" | "critical"  (Rastro solo avisa por correo cuando es "critical")
  - source: "helm-crm"
  - actor: el correo o id del usuario del CRM afectado (NO su contraseña ni datos sensibles)
  - ip, country: si los tienes
  - message: una frase corta ("5 intentos fallidos seguidos")
  - meta: objeto pequeño opcional (p. ej. { attempts: 5 })
  Respuesta esperada: 201 { ok: true, id, alerted }. 401 = clave mala, 403 = la clave no es de un titular de Rastro Equipos.

Tareas:
1. Detecta el stack de este proyecto (lenguaje y framework) y crea un helper reutilizable, por ejemplo `sentinel.<ext>`, con una función `reportSecurityEvent(event)` que:
   - Lea la clave de process.env.RASTRO_SENTINEL_KEY (o el equivalente del stack). Si no está, no haga nada (no rompas la app en dev).
   - Haga el POST en segundo plano, "fire-and-forget": timeout de ~3s, y captura/ignora cualquier error (un fallo de red NUNCA debe afectar al login ni a la petición del usuario). No await que bloquee la respuesta al usuario.
   - Ponga source="helm-crm" por defecto.

2. Añade llamadas en los puntos adecuados del código (búscalos, no los inventes):
   - Login FALLIDO: envía kind="login_failed", severity="warn", actor=<email intentado>, con ip/país si los tienes.
     - Lleva un contador por cuenta/IP en memoria o en la BD: si hay 5 o más fallos seguidos en pocos minutos para la misma cuenta, envía además kind="login_failed", severity="critical", message="N intentos fallidos seguidos", meta={ attempts: N }.
   - Login CORRECTO desde un país/IP NUEVO para ese usuario (si guardas histórico de accesos): kind="login_new_country", severity="warn" (o "critical" si quieres que avise siempre), actor=<email>, country=<país>.
   - EXPORTACIÓN masiva de datos (exportar contactos/clientes a CSV/Excel, o una consulta que devuelva muchos registros): kind="export_bulk", severity="critical", actor=<email>, message="Exportó N registros", meta={ rows: N }.
   - Alta de un ADMIN o subida de permisos de un usuario: kind="admin_added", severity="critical", actor=<quién lo hizo>, message=<a quién>.
   - Cambio de contraseña: kind="password_changed", severity="info", actor=<email>.

3. Privacidad: nunca envíes contraseñas, tokens, ni el contenido de los registros del CRM. Solo el correo/id del usuario (actor), ip, país y un mensaje corto. meta debe ser pequeño.

4. Añade RASTRO_SENTINEL_KEY al .env.example (sin valor) y documenta en el README en 3 líneas qué hace el Centinela y cómo desactivarlo (quitar la env).

5. No escribas tests que llamen de verdad a la API. Si haces algún test, mockea el POST.

Cuando termines, dime en qué archivos pusiste las llamadas y cómo probar un evento crítico de prueba (por ejemplo forzar 5 logins fallidos) para ver si me llega el correo.
```

---

## Cómo lo verás funcionar

- En **rastropro.com/equipo** (panel de Equipos) aparece la tarjeta **Centinela** con los últimos eventos.
- Cuando helm envíe un evento `severity:"critical"`, te llega un **correo** al titular (como mucho uno por tipo de evento cada hora, para no saturarte).
- Para probar sin tocar helm, puedes lanzar un evento a mano desde una terminal (sustituye la clave):

```bash
curl -X POST https://rastropro.com/api/v1/sentinel \
  -H "Authorization: Bearer rk_live_TU_CLAVE" \
  -H "Content-Type: application/json" \
  -d '{"kind":"export_bulk","severity":"critical","source":"prueba","actor":"ana@tuempresa.com","message":"Exportó 4.000 contactos","meta":{"rows":4000}}'
```

Si responde `201 {"ok":true,...,"alerted":true}` y te llega el correo, está conectado.
