#!/usr/bin/env bash
# Sirve el login de Firebase desde el dominio del juego (cocardo.app/__/auth/*) para que la ventana de Google diga
# «continuar a cocardo.app». GitHub Pages no puede atender esas rutas, así que se pone Cloudflare delante:
#   1. sube el Worker tools/auth-proxy/worker.js (reenvía /__/auth/* y /__/firebase/* a <proyecto>.firebaseapp.com)
#   2. crea la ruta <dominio>/__/* → Worker
#   3. pone el SSL de la zona en «Full» (si estuviera en «Flexible» o apagado, GitHub Pages haría un bucle de
#      redirecciones; «Full» y no «Full (strict)» para no depender de que GitHub renueve su certificado detrás del proxy)
#   4. activa el proxy (nube naranja) en los registros A/AAAA del apex; www sigue «DNS only» y GitHub lo redirige
#   5. comprueba que el juego y el handler de Firebase responden por https://<dominio>/
# Es idempotente: se puede correr de nuevo. Para deshacerlo: tools/setup-cloudflare-dns.sh (vuelve a «DNS only»).
#
# Después, en Google Cloud (una vez): Credenciales → «Web client (auto created by Google Service)» → URI de
# redireccionamiento autorizados → https://<dominio>/__/auth/handler; y en js/cloud-config.js, authDomain = '<dominio>'.
#
# Uso:  CLOUDFLARE_API_TOKEN=... tools/setup-cloudflare-auth.sh [dominio] [proyecto-firebase]
# Token (Cloudflare → My Profile → API Tokens → Create Custom Token), con estos permisos:
#   Account → Workers Scripts → Edit      Zone → Workers Routes → Edit
#   Zone → DNS → Edit                     Zone → Zone Settings → Edit
#   Zone Resources: Include → Specific zone → el dominio.  Account Resources: Include → tu cuenta.
set -euo pipefail

DOMAIN="${1:-cocardo.app}"
PROJECT="${2:-graceful-system-406208}"
SCRIPT_NAME="cocardo-auth-proxy"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKER="$ROOT/tools/auth-proxy/worker.js"
: "${CLOUDFLARE_API_TOKEN:?Falta CLOUDFLARE_API_TOKEN (permisos: Workers Scripts, Workers Routes, DNS y Zone Settings en Edit)}"
API="https://api.cloudflare.com/client/v4"

cf() {  # cf METODO RUTA [JSON]
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -sS -X "$method" "$API$path" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" --data "$body"
  else
    curl -sS -X "$method" "$API$path" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
  fi
}
py() { python3 -I -c "$1" "${@:2}"; }
ok() { py 'import json,sys; d=json.load(sys.stdin); assert d.get("success"), d.get("errors") or d; print(sys.argv[1] if len(sys.argv)>1 else "  ok")' "$@"; }

echo "→ Comprobando el token…"
cf GET /user/tokens/verify | ok "  token activo"

echo "→ Zona $DOMAIN"
ZONE=$(cf GET "/zones?name=$DOMAIN" | py 'import json,sys; d=json.load(sys.stdin); r=d.get("result") or []; assert d.get("success") and r, ("zona no encontrada o sin permiso", d.get("errors")); print(r[0]["id"], r[0]["account"]["id"])')
read -r ZONE_ID ACCOUNT_ID <<<"$ZONE"
[ -n "${ZONE_ID:-}" ] && [ -n "${ACCOUNT_ID:-}" ] || { echo "No se pudo leer la zona $DOMAIN" >&2; exit 1; }
echo "  zona $ZONE_ID · cuenta $ACCOUNT_ID"

echo "→ Worker $SCRIPT_NAME (Firebase: $PROJECT.firebaseapp.com)"
META=$(py 'import json,sys; print(json.dumps({"main_module":"worker.js","compatibility_date":"2026-09-01","bindings":[{"type":"plain_text","name":"FIREBASE_PROJECT","text":sys.argv[1]}]}))' "$PROJECT")
curl -sS -X PUT "$API/accounts/$ACCOUNT_ID/workers/scripts/$SCRIPT_NAME" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -F "metadata=$META;type=application/json" -F "worker.js=@$WORKER;type=application/javascript+module" | ok "  subido"

echo "→ Ruta $DOMAIN/__/* → $SCRIPT_NAME"
PATTERN="$DOMAIN/__/*"
ROUTE_ID=$(cf GET "/zones/$ZONE_ID/workers/routes" | py 'import json,sys
d=json.load(sys.stdin); assert d.get("success"), d.get("errors")
print(next((r["id"] for r in d.get("result") or [] if r.get("pattern")==sys.argv[1]), ""))' "$PATTERN")
ROUTE_BODY=$(py 'import json,sys; print(json.dumps({"pattern":sys.argv[1],"script":sys.argv[2]}))' "$PATTERN" "$SCRIPT_NAME")
if [ -n "$ROUTE_ID" ]; then
  cf PUT "/zones/$ZONE_ID/workers/routes/$ROUTE_ID" "$ROUTE_BODY" | ok "  = ya existía (actualizada)"
else
  cf POST "/zones/$ZONE_ID/workers/routes" "$ROUTE_BODY" | ok "  + creada"
fi

echo "→ SSL de la zona"
SSL=$(cf GET "/zones/$ZONE_ID/settings/ssl" | py 'import json,sys; d=json.load(sys.stdin); assert d.get("success"), d.get("errors"); print(d["result"]["value"])')
if [ "$SSL" = "full" ]; then
  echo "  = full"
else
  RES=$(cf PATCH "/zones/$ZONE_ID/settings/ssl" '{"value":"full"}')
  if ! printf '%s' "$RES" | py 'import json,sys; sys.exit(0 if json.load(sys.stdin).get("success") else 1)'; then
    # con el modo automático de SSL/TLS activo, Cloudflare no deja fijar el modo a mano: se pasa a «custom» y se reintenta
    cf PATCH "/zones/$ZONE_ID/settings/ssl_automatic_mode" '{"value":"custom"}' >/dev/null || true
    RES=$(cf PATCH "/zones/$ZONE_ID/settings/ssl" '{"value":"full"}')
  fi
  printf '%s' "$RES" | ok "  $SSL → full"
fi

echo "→ Proxy de Cloudflare en el apex ($DOMAIN A/AAAA)"
cf GET "/zones/$ZONE_ID/dns_records?name=$DOMAIN&per_page=100" | py 'import json,sys
d=json.load(sys.stdin); assert d.get("success"), d.get("errors")
for r in d["result"]:
    if r["type"] in ("A","AAAA"): print(r["id"], r["type"], r["content"], r["proxied"])' | while read -r id type content proxied; do
  if [ "$proxied" = "True" ]; then
    echo "  = $type $content (ya con proxy)"
  else
    cf PATCH "/zones/$ZONE_ID/dns_records/$id" '{"proxied":true}' | ok "  ~ $type $content → con proxy"
  fi
done

echo "→ Comprobación (puede tardar unos segundos en propagarse)"
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  SITE=$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/")
  HANDLER=$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/__/auth/handler")
  if [ "$SITE" = "200" ] && [ "$HANDLER" = "200" ] && curl -s "https://$DOMAIN/__/auth/handler" | grep -q 'handler.js'; then break; fi
  sleep 5
done
echo "  https://$DOMAIN/ → $SITE   https://$DOMAIN/__/auth/handler → $HANDLER"
SERVER=$(curl -sI "https://$DOMAIN/" | tr -d '\r' | awk -F': ' 'tolower($1)=="server"{print $2}')
echo "  servidor: $SERVER (cloudflare = proxy activo)"
[ "$SITE" = "200" ] && [ "$HANDLER" = "200" ] || { echo "Algo no responde todavía; vuelve a correr el script en un minuto." >&2; exit 1; }

cat <<MSG

Listo. Falta (una vez) en Google Cloud → APIs y servicios → Credenciales → «Web client (auto created by Google
Service)» → URI de redireccionamiento autorizados → Agregar: https://$DOMAIN/__/auth/handler → Guardar.
Después: authDomain = '$DOMAIN' en js/cloud-config.js y subir el cambio.
MSG
