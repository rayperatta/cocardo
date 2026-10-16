#!/usr/bin/env bash
# Sirve el login de Firebase desde el dominio del juego (cocardo.app/__/auth/*) para que la ventana de Google diga
# «continuar a cocardo.app». GitHub Pages no puede atender esas rutas, así que se pone Cloudflare delante:
#   1. sube el Worker tools/auth-proxy/worker.js (reenvía /__/auth/* y /__/firebase/* a <proyecto>.firebaseapp.com)
#   2. crea la ruta <dominio>/__/* → Worker
#   3. SSL de la zona en «Full» y en modo manual. «Flexible» haría un bucle de redirecciones con GitHub Pages, y
#      «Full (strict)» tumbaría el sitio con un 526 si GitHub no logra renovar su certificado detrás del proxy (lo
#      normal: su Let's Encrypt necesita que el DNS apunte a GitHub). El modo automático de Cloudflare se apaga
#      porque podría subir solo a «Full (strict)» y nunca vuelve a bajar.
#   4. caché del navegador según las cabeceras de GitHub (10 min), no las 4 h por defecto de Cloudflare
#   5. activa el proxy (nube naranja) en el apex (A/AAAA) y en www (CNAME): así los dos usan el certificado de
#      Cloudflare y no dependen del de GitHub; GitHub sigue redirigiendo www → apex
#   6. comprueba que el juego, el handler de Firebase y la redirección de www responden a través de Cloudflare
# Es idempotente: se puede correr de nuevo.
#
# Para deshacerlo (en este orden; si no, «Entrar con Google» da error):
#   1. js/cloud-config.js: authDomain = '<proyecto>.firebaseapp.com'; subir el cambio y esperar el build de Pages.
#   2. esperar 10 min: los navegadores guardan cloud-config.js ese tiempo (purgar Cloudflare no borra esa caché).
#   3. tools/setup-cloudflare-dns.sh (vuelve a «DNS only»). La ruta y el Worker quedan sin efecto; se pueden borrar.
# En el cliente OAuth conviene dejar las DOS URI de redirección (la de <dominio> y la de <proyecto>.firebaseapp.com):
# así cualquiera de los dos authDomain funciona, también para quien tenga la configuración vieja en caché.
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

setting() { cf GET "/zones/$ZONE_ID/settings/$1" | py 'import json,sys; d=json.load(sys.stdin); assert d.get("success"), d.get("errors"); print(d["result"]["value"])'; }

echo "→ SSL de la zona (manual, Full)"
AUTO=$(cf GET "/zones/$ZONE_ID/settings/ssl_automatic_mode" | py 'import json,sys; d=json.load(sys.stdin); print(d["result"]["value"] if d.get("success") and d.get("result") else "n/a")')
if [ "$AUTO" = "custom" ] || [ "$AUTO" = "n/a" ]; then
  echo "  = modo automático: $AUTO"
else
  cf PATCH "/zones/$ZONE_ID/settings/ssl_automatic_mode" '{"value":"custom"}' | ok "  modo automático ($AUTO) → custom"
fi
SSL=$(setting ssl)
if [ "$SSL" = "full" ]; then echo "  = full"; else cf PATCH "/zones/$ZONE_ID/settings/ssl" '{"value":"full"}' | ok "  $SSL → full"; fi
[ "$(setting ssl)" = "full" ] || { echo "El SSL no quedó en full; no se activa el proxy." >&2; exit 1; }

echo "→ Caché del navegador: respetar las cabeceras de GitHub"
BCT=$(setting browser_cache_ttl)
if [ "$BCT" = "0" ]; then echo "  = respeta las cabeceras"; else cf PATCH "/zones/$ZONE_ID/settings/browser_cache_ttl" '{"value":0}' | ok "  $BCT s → respeta las cabeceras (max-age=600 de GitHub)"; fi

echo "→ Proxy de Cloudflare en $DOMAIN (A/AAAA) y www.$DOMAIN (CNAME)"
for NAME in "$DOMAIN" "www.$DOMAIN"; do
  cf GET "/zones/$ZONE_ID/dns_records?name=$NAME&per_page=100" | py 'import json,sys
d=json.load(sys.stdin); assert d.get("success"), d.get("errors")
for r in d["result"]:
    if r["type"] in ("A","AAAA","CNAME"): print(r["id"], r["type"], r["name"], r["content"], r["proxied"])' | while read -r id type name content proxied; do
    if [ "$proxied" = "True" ]; then
      echo "  = $type $name → $content (ya con proxy)"
    else
      cf PATCH "/zones/$ZONE_ID/dns_records/$id" '{"proxied":true}' | ok "  ~ $type $name → $content: con proxy"
    fi
  done
done

echo "→ Comprobación (preguntando directo a Cloudflare, sin la caché de DNS de esta computadora)"
NS=$(cf GET "/zones/$ZONE_ID" | py 'import json,sys; print((json.load(sys.stdin)["result"].get("name_servers") or [""])[0])')
# dig y curl no deben cortar el script (set -e): un fallo cuenta como «todavía no» y se reintenta
ip_of() { { command -v dig >/dev/null 2>&1 && [ -n "$NS" ] && dig +short +time=2 +tries=1 @"$NS" "$1" A 2>/dev/null | grep -Em1 '^[0-9.]+$'; } || true; }
via() { [ -n "$2" ] && echo "--resolve $1:443:$2"; true; }   # sin IP de Cloudflare se usa el DNS normal
probe() { curl -sS --max-time 10 $(via "$1" "$2") -o /dev/null -w '%{http_code} %{redirect_url}' "https://$1$3" 2>/dev/null || echo "000"; }
GOOD=""
for i in $(seq 1 24); do
  # las IP se vuelven a pedir en cada vuelta: justo después del cambio Cloudflare todavía puede dar las de GitHub
  IP=$(ip_of "$DOMAIN"); WIP=$(ip_of "www.$DOMAIN")
  SITE=$(probe "$DOMAIN" "$IP" /); HANDLER=$(probe "$DOMAIN" "$IP" /__/auth/handler); WWW=$(probe "www.$DOMAIN" "$WIP" /)
  SERVER=$( { curl -sSI --max-time 10 $(via "$DOMAIN" "$IP") "https://$DOMAIN/" 2>/dev/null || true; } | tr -d '\r' | awk -F': ' 'tolower($1)=="server"{print $2}')
  BODY=$( { curl -sS --max-time 10 $(via "$DOMAIN" "$IP") "https://$DOMAIN/__/auth/handler" 2>/dev/null || true; } | grep -c 'handler.js' || true)
  if [ "${SITE%% *}" = "200" ] && [ "${HANDLER%% *}" = "200" ] && [ "${BODY:-0}" != "0" ] && [ "$SERVER" = "cloudflare" ] && [ "$WWW" = "301 https://$DOMAIN/" ]; then GOOD=1; break; fi
  sleep 5
done
echo "  https://$DOMAIN/ → ${SITE%% *}   /__/auth/handler → ${HANDLER%% *}   servidor: ${SERVER:-?}   (vía ${IP:-?})"
echo "  https://www.$DOMAIN/ → $WWW"
[ -n "$GOOD" ] || { echo "Algo no responde todavía (el proxy ya quedó activo). Vuelve a correr el script en un minuto; si sigue igual, revisa el SSL y la ruta del Worker en el panel de Cloudflare." >&2; exit 1; }

cat <<MSG

Listo. Si es la primera vez, en Google Cloud → APIs y servicios → Credenciales → «Web client (auto created by Google
Service)» → URI de redireccionamiento autorizados deben estar las dos:
  https://$DOMAIN/__/auth/handler   y   https://$PROJECT.firebaseapp.com/__/auth/handler
Después: authDomain = '$DOMAIN' en js/cloud-config.js y subir el cambio.
MSG
