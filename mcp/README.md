# Rastro MCP

Conecta Claude (Claude Desktop o Claude Code) con tu cuenta de **Rastro** para:

- **Llevar tus reportes de bug bounty en Rastro Lab:** listar y crear trabajos, añadir hallazgos y CVE, y sacar el informe en Markdown.
- **Usar las herramientas de defensa:** informe de exposición de un dominio (SPF/DMARC, web, dominios parecidos), guardián de estafas y catálogo de sitios que venden datos.

Solo accede a **tu** cuenta, con tu clave de API. Nunca a datos de terceros.

## 1. Tu clave de API
En rastropro.com: **Perfil → API → Crear clave**. Copia la clave `rk_live_…` (se enseña una vez).

## 2. Configurarlo en Claude
Añade este servidor a tu cliente MCP. No instala nada: usa el Node que ya tienes (18+).

**Claude Desktop** (`claude_desktop_config.json`) o **Claude Code** (`.mcp.json`):
```json
{
  "mcpServers": {
    "rastro": {
      "command": "node",
      "args": ["/ruta/a/rastro/mcp/rastro-mcp.mjs"],
      "env": { "RASTRO_API_KEY": "rk_live_tu_clave" }
    }
  }
}
```
Para apuntar a otro servidor (desarrollo): añade `"RASTRO_BASE_URL": "http://localhost:3000"` en `env`.

## 3. Úsalo
Pídele a Claude cosas como:
- "Crea un trabajo en Rastro Lab para la máquina Bedside y añade el CVE-2025-64512 de pdfminer.six."
- "Añade un hallazgo de path traversal al trabajo y dame el informe en Markdown."
- "Pásame el informe de exposición del dominio de este cliente: ejemplo.es."
- "¿Es una estafa este SMS? …"

## Herramientas
`lab_list_jobs`, `lab_get_job`, `lab_create_job`, `lab_add_finding`, `lab_add_cve`, `lab_add_hypothesis`, `lab_report_markdown`, `domain_report`, `guardian_check`, `sites_catalog`.

## Privacidad y alcance
- El Lab y el guardián requieren Rastro Pro (o cuenta de administrador).
- Rastro Lab es un cuaderno: no ejecuta escaneos ni exploits. Organiza y redacta. Los comandos los corres tú en tu terminal o tu VPS.
- `domain_report` trabaja a nivel de empresa (dominio), sin datos personales. Úsalo sobre dominios tuyos o de clientes con permiso.
