#!/bin/bash
# Vigilante local: si /api/health no responde 200 dos veces seguidas, reinicia la app.
# Con systemd (rastro.service, Restart=always) basta con cerrar el proceso; si no, pm2.
# Cron: */5 * * * * /home/s4sf/rastro/deploy/watchdog.sh
export PATH=$HOME/.npm-global/bin:$PATH
ok() { curl -fsS --max-time 15 http://localhost:3000/api/health >/dev/null 2>&1; }
if ! ok; then sleep 20; if ! ok; then
  echo "$(date -Is) rastro sin respuesta: reinicio" >> "$HOME/backups/rastro-watchdog.log"
  if systemctl is-enabled rastro >/dev/null 2>&1; then RPID=$(ss -ltnp 2>/dev/null | grep ":3000 " | grep -o "pid=[0-9]*" | head -1 | cut -d= -f2); [ -n "$RPID" ] && kill "$RPID" || true  # systemd lo relanza
  else cd "$HOME/rastro" && (pm2 restart rastro --update-env >/dev/null 2>&1 || pm2 start deploy/ecosystem.config.cjs --only rastro >/dev/null 2>&1); fi
fi; fi
