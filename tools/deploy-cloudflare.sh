#!/usr/bin/env bash
# Cocardo: ¡Rescate Helado! — Publica el juego en Cloudflare (sustituye a GitHub Pages como servidor; el repositorio
# sigue en GitHub). Dos Workers:
#   cocardo-sitio  archivos estáticos (dist/site) en la ruta cocardo.app/*   (tools/cloudflare/wrangler.toml)
#   cocardo-www    redirección www.cocardo.app → cocardo.app                (tools/cloudflare/www/wrangler.toml)
# Las rutas cocardo.app/__/* (login de Google) y cocardo.app/api/* (pagos) son de otros Workers y no se tocan.
# El DNS no cambia (sigue apuntando a GitHub Pages con proxy): la ruta cocardo.app/* responde antes de llegar al
# origen. Para deshacer: borrar las rutas de los dos Workers en Cloudflare → Workers Routes (o `wrangler delete`).
#
# Uso:  CLOUDFLARE_API_TOKEN=… tools/deploy-cloudflare.sh [--check]
#   --check   solo comprueba el sitio publicado (sin desplegar)
# Token (Cloudflare → My Profile → API Tokens): Account → Workers Scripts: Edit · Zone → Workers Routes: Edit ·
#   Zone → Zone: Read, para la zona cocardo.app. CLOUDFLARE_ACCOUNT_ID es opcional (se saca de la zona).
# Cada vez que cambie el juego: git push (repositorio) + este script (publicación). Súbelo a VERSION en sw.js antes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="cocardo.app"
API="https://api.cloudflare.com/client/v4"
CHECK_ONLY=0
[ "${1:-}" = "--check" ] && CHECK_ONLY=1

check() {
  echo "→ Comprobando https://$DOMAIN"
  local fail=0
  code() { curl -sS -o /dev/null -w '%{http_code}' -H 'Cache-Control: no-cache' "$1"; }
  hdr() { curl -sSI -H 'Cache-Control: no-cache' "$1" | tr -d '\r' | grep -i "^$2:" | head -1; }
  local c
  c=$(code "https://$DOMAIN/?check=$RANDOM"); echo "  / → $c"; [ "$c" = "200" ] || fail=1
  c=$(code "https://$DOMAIN/js/core/roadmap.js?check=$RANDOM"); echo "  /js/core/roadmap.js → $c"; [ "$c" = "200" ] || fail=1
  c=$(code "https://$DOMAIN/landing?check=$RANDOM"); echo "  /landing → $c"; [ "$c" = "200" ] || fail=1
  c=$(curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' "https://$DOMAIN/landing.html"); echo "  /landing.html → $c (debe ser 307 a /landing)"; case "$c" in 307*"/landing") ;; *) fail=1;; esac
  c=$(code "https://$DOMAIN/?go=daily"); echo "  /?go=daily → $c"; [ "$c" = "200" ] || fail=1
  echo "  /sw.js → $(code "https://$DOMAIN/sw.js?check=$RANDOM") · $(hdr "https://$DOMAIN/sw.js" cache-control)"
  echo "  VERSION publicada: $(curl -sS -H 'Cache-Control: no-cache' "https://$DOMAIN/sw.js?check=$RANDOM" | grep -o "cocardo-v[0-9.]*" | head -1)"
  for p in docs/CALENDARIO.md tools/sim.js tests/helpers.js firebase/firestore.rules README.md package.json; do
    c=$(code "https://$DOMAIN/$p?check=$RANDOM"); echo "  /$p → $c (debe ser 404)"; [ "$c" = "404" ] || fail=1
  done
  c=$(code "https://$DOMAIN/__/auth/handler"); echo "  /__/auth/handler (login de Google, otro Worker) → $c"; [ "$c" = "200" ] || fail=1
  c=$(curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' "https://www.$DOMAIN/?x=1"); echo "  www → $c (debe ser 301 a https://$DOMAIN/?x=1)"; case "$c" in 301*"https://$DOMAIN/?x=1") ;; *) fail=1;; esac
  c=$(curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' "https://$DOMAIN/landing/"); echo "  /landing/ → $c (debe ser 301 a /landing)"; case "$c" in 301*"/landing") ;; *) fail=1;; esac
  if [ "$fail" = 1 ]; then echo "✗ Hay comprobaciones fallidas" >&2; return 1; fi
  echo "✓ Sitio publicado y rutas de Workers intactas"
}

if [ "$CHECK_ONLY" = 1 ]; then check; exit $?; fi

: "${CLOUDFLARE_API_TOKEN:?Falta CLOUDFLARE_API_TOKEN (Workers Scripts: Edit, Workers Routes: Edit, Zone: Read en $DOMAIN)}"
export CLOUDFLARE_API_TOKEN
if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  CLOUDFLARE_ACCOUNT_ID=$(curl -sS "$API/zones?name=$DOMAIN" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    | python3 -I -c 'import json,sys; d=json.load(sys.stdin); r=d.get("result") or []; assert d.get("success") and r, d.get("errors"); print(r[0]["account"]["id"])')
fi
export CLOUDFLARE_ACCOUNT_ID
export WRANGLER_SEND_METRICS=false CI=1

echo "→ Armando dist/site"
node "$ROOT/tools/cloudflare/build-site.cjs"

WR="npx --yes wrangler@4"
echo "→ Desplegando cocardo-sitio (archivos estáticos, ruta $DOMAIN/*)"
( cd "$ROOT" && $WR deploy --config tools/cloudflare/wrangler.toml )
echo "→ Desplegando cocardo-www (redirección www → $DOMAIN)"
( cd "$ROOT" && $WR deploy --config tools/cloudflare/www/wrangler.toml )

echo "→ Rutas de Workers de la zona (deben seguir /__/* y /api/* además de las nuevas):"
ZONE_ID=$(curl -sS "$API/zones?name=$DOMAIN" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | python3 -I -c 'import json,sys; print(json.load(sys.stdin)["result"][0]["id"])')
curl -sS "$API/zones/$ZONE_ID/workers/routes" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  | python3 -I -c 'import json,sys; d=json.load(sys.stdin); [print("  ", r.get("pattern"), "→", r.get("script")) for r in d.get("result") or []]'
sleep 5
check
