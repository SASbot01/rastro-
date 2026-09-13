#!/bin/bash
# Copia de seguridad diaria de la base de datos de Rastro (Postgres de Supabase local en Docker).
# Guarda 14 dias en ~/backups/rastro. Cron: 30 3 * * * /home/s4sf/rastro/deploy/backup.sh
set -euo pipefail
DIR="$HOME/backups/rastro"; mkdir -p "$DIR"
C=$(docker ps --format '{{.Names}}' | grep supabase_db_rastro | head -1)
[ -n "$C" ] || { echo "sin contenedor de BD"; exit 1; }
F="$DIR/rastro-$(date +%Y%m%d-%H%M).sql.gz"
docker exec "$C" pg_dump -U postgres -d postgres --no-owner --no-privileges --schema=public | gzip -9 > "$F"
# Comprobacion minima: el volcado debe contener las tablas principales.
[ "$(gzip -dc "$F" | grep -c "CREATE TABLE public.reports")" -ge 1 ] || { echo "volcado sospechoso: $F"; exit 1; }
find "$DIR" -name 'rastro-*.sql.gz' -mtime +14 -delete
echo "ok $F $(du -h "$F" | cut -f1)"
