#!/usr/bin/env bash
# Despliega el codigo local en el servidor (rastropro.com) por Tailscale.
#   ./deploy/push.sh
# Copia el codigo (sin node_modules, .next ni .env.local), instala si cambio
# package.json, aplica migraciones nuevas, construye y reinicia la app.
set -euo pipefail
HOST="${RASTRO_HOST:-100.114.169.107}"
cd "$(dirname "$0")/.."

echo "→ copiando codigo a $HOST:~/rastro"
rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .env.local \
  --exclude 'supabase/.temp' --exclude .git \
  ./ "$HOST:~/rastro/"

ssh "$HOST" 'set -e; export PATH=$HOME/.npm-global/bin:$PATH; cd ~/rastro
  npm install --no-audit --no-fund 2>&1 | tail -1
  supabase migration up 2>&1 | grep -vE "new version|recommend" | tail -1 || true
  docker exec supabase_db_rastro psql -U postgres -d postgres -Atc "notify pgrst, '"'"'reload schema'"'"';" >/dev/null
  NEXT_TELEMETRY_DISABLED=1 npm run build 2>&1 | grep -E "Compiled|TypeScript|rror" | head -3
  pm2 restart rastro --update-env >/dev/null && sleep 3
  echo "→ $(curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3000/) en local, $(curl -s -o /dev/null -w "HTTP %{http_code}" --max-time 20 https://rastropro.com/) en rastropro.com"'
