#!/bin/bash
# Vigilante local: si /api/health no responde 200 dos veces seguidas, reinicia rastro en pm2.
# Cron: */5 * * * * /home/s4sf/rastro/deploy/watchdog.sh
export PATH=$HOME/.npm-global/bin:$PATH
ok() { curl -fsS --max-time 15 http://localhost:3000/api/health >/dev/null 2>&1; }
if ! ok; then sleep 20; if ! ok; then
  echo "$(date -Is) rastro sin respuesta: reinicio" >> "$HOME/backups/rastro-watchdog.log"
  cd "$HOME/rastro" && (pm2 restart rastro --update-env >/dev/null 2>&1 || pm2 start deploy/ecosystem.config.cjs --only rastro >/dev/null 2>&1)
fi; fi
