#!/usr/bin/env bash
# Vuelca la URL y las claves del Supabase local (supabase start) en .env.local.
# Uso: ./scripts/use-local-supabase.sh
set -euo pipefail
cd "$(dirname "$0")/.."

eval "$(supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
: "${API_URL:?supabase no esta arrancado (ejecuta: supabase start)}"

python3 - "$API_URL" "$ANON_KEY" "$SERVICE_ROLE_KEY" <<'PY'
import re, sys, pathlib
url, anon, service = sys.argv[1:4]
p = pathlib.Path(".env.local"); s = p.read_text()
for k, v in {"NEXT_PUBLIC_SUPABASE_URL": url, "NEXT_PUBLIC_SUPABASE_ANON_KEY": anon, "SUPABASE_SERVICE_ROLE_KEY": service}.items():
    s, n = re.subn(rf"^{k}=.*$", f"{k}={v}", s, flags=re.M)
    if not n: s += f"\n{k}={v}"
p.write_text(s)
print(f"OK .env.local -> Supabase local en {url}")
PY
