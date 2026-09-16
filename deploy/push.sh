#!/usr/bin/env bash
# Despliega el codigo local en el servidor (rastropro.com) por Tailscale.
#   ./deploy/push.sh
# Seguro por diseno: si los tipos fallan en local o el build falla en el
# servidor, NO se reinicia la app (sigue la version anterior).
set -euo pipefail
HOST="${RASTRO_HOST:-100.114.169.107}"
cd "$(dirname "$0")/.."

echo "→ comprobando tipos en local"
npx tsc --noEmit 2>&1 | grep -v '^\.next' | grep -E 'error TS' && { echo "✗ errores de tipos: no se despliega"; exit 1; } || true

echo "→ copiando codigo a $HOST:~/rastro"
rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .env.local \
  --exclude 'supabase/.temp' --exclude .git \
  ./ "$HOST:~/rastro/"

ssh "$HOST" 'set -euo pipefail; export PATH=$HOME/.npm-global/bin:$PATH; cd ~/rastro
  npm install --no-audit --no-fund 2>&1 | tail -1
  supabase migration up 2>&1 | grep -vE "new version|recommend" | tail -1 || true
  docker exec supabase_db_rastro psql -U postgres -d postgres -Atc "notify pgrst, '"'"'reload schema'"'"';" >/dev/null
  # Copia de seguridad de .next: si el build falla, se restaura y pm2 sigue con la version anterior.
  rm -rf .next.bak; [ -d .next ] && cp -r .next .next.bak
  if NEXT_TELEMETRY_DISABLED=1 npm run build > /tmp/rastro-build.log 2>&1; then
    rm -rf .next.bak
    grep -E "Compiled|TypeScript" /tmp/rastro-build.log | head -2
    # La app corre bajo systemd (rastro.service, Restart=always). Sin sudo no se puede
    # hacer systemctl restart: se cierra el proceso y systemd lo levanta con la build nueva.
    if systemctl is-enabled rastro >/dev/null 2>&1; then
      pkill -u "$USER" -f "next start -p 3000" || true
      for i in $(seq 1 20); do sleep 2; curl -fsS --max-time 5 http://localhost:3000/api/health >/dev/null 2>&1 && break; done
    else
      pm2 restart rastro --update-env >/dev/null 2>&1 || pm2 start deploy/ecosystem.config.cjs --only rastro >/dev/null 2>&1; pm2 save >/dev/null 2>&1; sleep 4
    fi
    curl -fsS --max-time 10 http://localhost:3000/api/health >/dev/null 2>&1 || { echo "✗ la app no responde tras el reinicio"; exit 1; }
    echo "→ $(curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3000/) en local, $(curl -s -o /dev/null -w "HTTP %{http_code}" --max-time 20 https://rastropro.com/) en rastropro.com"
  else
    echo "✗ build fallido en el servidor: NO se reinicia la app"; grep -E "error|Error" /tmp/rastro-build.log | head -8
    [ -d .next.bak ] && rm -rf .next && mv .next.bak .next; exit 1
  fi'
