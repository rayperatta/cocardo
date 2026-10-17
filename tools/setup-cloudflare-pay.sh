#!/usr/bin/env bash
# Instala el Worker de pagos «cocardo-pagos» (tools/pay-worker/worker.js) en <dominio>/api/*:
#   1. sube el Worker con sus variables (plain_text), el límite de pedidos (binding RATE_LIMIT) y conserva los secretos
#      que ya tenía (keep_bindings)
#   2. guarda como secretos los que vengan en variables de entorno; los que no vengan quedan como estaban
#   3. crea la ruta <dominio>/api/* → cocardo-pagos. No toca la ruta /__/* ni el Worker del login (cocardo-auth-proxy)
#   4. avisa si falta algún secreto y prueba https://<dominio>/api/health
# Es idempotente: se puede correr de nuevo (por ejemplo para pasar de sandbox a live con las claves de live).
# Los secretos nunca se escriben a disco ni se imprimen, y no van en la línea de comandos de curl (ps): el token de
# Cloudflare entra como configuración de curl por un descriptor (-K <(…)) y cada secreto como cuerpo por stdin.
#
# Uso:
#   CLOUDFLARE_API_TOKEN=… PADDLE_ENV=sandbox PADDLE_PRICE_ID=pri_… TEST_UIDS=<tu uid>[,otro] \
#   [PADDLE_API_KEY=…] [PADDLE_WEBHOOK_SECRET=…] [GCP_SA_EMAIL=…] [GCP_SA_KEY=…] \
#   tools/setup-cloudflare-pay.sh [dominio] [proyecto-firebase]
#
# Variables del Worker (texto plano, se suben siempre):
#   PADDLE_ENV         sandbox | live (obligatoria: así nunca se cambia de entorno sin querer)
#   PADDLE_PRICE_ID    pri_… del precio «juego completo» (el mismo que pay.priceId en js/cloud-config.js)
#   FIREBASE_API_KEY   por defecto la apiKey de js/cloud-config.js (es pública)
#   SITE_ORIGINS       orígenes con CORS, separados por comas; por defecto https://<dominio>
#                      (para probar desde la compu: SITE_ORIGINS="https://cocardo.app,http://localhost:8080")
#   FIREBASE_PROJECT   el segundo argumento
#   TEST_UIDS          solo sandbox: uids de Firebase (separados por comas) que pueden comprar y recibir el permiso;
#                      las demás compras de prueba quedan sin dueño. Sin TEST_UIDS el sandbox no da permisos a nadie.
#                      El uid de tu cuenta: consola de Firebase → Authentication → Users → User UID. En live no se usa
# Límite de pedidos (binding RATE_LIMIT, Workers Rate Limiting): 6 pedidos por minuto por IP y por cuenta a
#   /api/checkout y /api/restore (el webhook no se limita). RATE_LIMIT=off lo quita si la cuenta no lo permite.
# Secretos (solo se cambian los que vengan; para no dejarlos en el historial: read -rs PADDLE_API_KEY; export PADDLE_API_KEY):
#   PADDLE_API_KEY         Paddle → My account → Settings → Authentication → API keys. Empieza con pdl_sdbx_apikey_
#                          en sandbox y pdl_live_apikey_ en live. Permisos: transaction.read, transaction.write y
#                          customer.read. Vence (90 días por defecto, máximo 1 año): ponle el máximo y anota la fecha;
#                          vencida, «Comprar» falla (log checkout_fail con code forbidden) hasta subir una nueva
#   PADDLE_WEBHOOK_SECRET  la «secret key» del destino de notificaciones (ver abajo; Paddle la muestra una sola vez)
#   GCP_SA_EMAIL, GCP_SA_KEY  cuenta de servicio de Google con el rol «Cloud Datastore User» (roles/datastore.user)
#                          en el proyecto de Firebase. GCP_SA_KEY es su private_key (PEM PKCS8, «BEGIN PRIVATE KEY»):
#     export GCP_SA_EMAIL="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["client_email"])' clave.json)"
#     export GCP_SA_KEY="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["private_key"])' clave.json)"
#   (después conviene borrar clave.json: la clave queda guardada en Cloudflare)
#
# Token de Cloudflare (My Profile → API Tokens → Create Custom Token):
#   Account → Workers Scripts → Edit      Zone → Workers Routes → Edit (zona del dominio)
#
# El destino del webhook (https://<dominio>/api/webhook) lo crea tools/setup-paddle.cjs, que imprime su
# PADDLE_WEBHOOK_SECRET una vez (o otra vez con --show-secret): pásalo aquí. No crees otro a mano en el panel: cada
# destino tiene su propio secreto y el Worker acepta uno solo (las entregas del otro fallarían con 401). Solo si no
# usaste el script: Paddle → Events → Notifications → New destination con los eventos transaction.completed,
# adjustment.created y adjustment.updated. Sandbox y live tienen destinos, claves y secretos distintos.
set -euo pipefail

DOMAIN="${1:-cocardo.app}"
PROJECT="${2:-graceful-system-406208}"
SCRIPT_NAME="cocardo-pagos"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKER="$ROOT/tools/pay-worker/worker.js"
SECRETS=(PADDLE_API_KEY PADDLE_WEBHOOK_SECRET GCP_SA_EMAIL GCP_SA_KEY)
API="https://api.cloudflare.com/client/v4"

: "${CLOUDFLARE_API_TOKEN:?Falta CLOUDFLARE_API_TOKEN (permisos: Workers Scripts y Workers Routes en Edit)}"
: "${PADDLE_ENV:?Falta PADDLE_ENV (sandbox o live)}"
: "${PADDLE_PRICE_ID:?Falta PADDLE_PRICE_ID (pri_… del precio en Paddle → Catalog)}"
case "$PADDLE_ENV" in sandbox|live) ;; *) echo "PADDLE_ENV debe ser sandbox o live" >&2; exit 1 ;; esac
[[ "$PADDLE_PRICE_ID" =~ ^pri_[a-z0-9]+$ ]] || { echo "PADDLE_PRICE_ID no parece un precio de Paddle (pri_…)" >&2; exit 1; }
if [ -z "${FIREBASE_API_KEY:-}" ]; then
  FIREBASE_API_KEY="$(sed -n "s/.*apiKey: *'\([^']*\)'.*/\1/p" "$ROOT/js/cloud-config.js" | head -n1)"
fi
[ -n "$FIREBASE_API_KEY" ] || { echo "Falta FIREBASE_API_KEY (no está en js/cloud-config.js)" >&2; exit 1; }
SITE_ORIGINS="${SITE_ORIGINS:-https://$DOMAIN}"
FIREBASE_PROJECT="$PROJECT"
TEST_UIDS="$(printf '%s' "${TEST_UIDS:-}" | tr -d ' ')"
[[ "$TEST_UIDS" =~ ^[A-Za-z0-9_,-]*$ ]] || { echo "TEST_UIDS: uids de Firebase separados por comas" >&2; exit 1; }
RATE_LIMIT="${RATE_LIMIT:-on}"
export PADDLE_ENV PADDLE_PRICE_ID FIREBASE_API_KEY SITE_ORIGINS FIREBASE_PROJECT TEST_UIDS RATE_LIMIT
if [ "$PADDLE_ENV" = sandbox ] && [ -z "$TEST_UIDS" ]; then
  echo "Aviso: sin TEST_UIDS el Worker de sandbox no deja comprar ni da permisos a ninguna cuenta (docs/PAGOS.md §3)." >&2
fi

# Los secretos que vengan se revisan antes de subir nada (sin mostrarlos)
if [ -n "${PADDLE_API_KEY:-}" ]; then
  WANT=$([ "$PADDLE_ENV" = live ] && echo pdl_live_ || echo pdl_sdbx_)
  case "$PADDLE_API_KEY" in
    pdl_live_*|pdl_sdbx_*) [[ "$PADDLE_API_KEY" == "$WANT"* ]] || { echo "PADDLE_API_KEY no es una clave de $PADDLE_ENV" >&2; exit 1; } ;;
  esac
fi
if [ -n "${GCP_SA_KEY:-}" ] && [[ "$GCP_SA_KEY" != *"BEGIN PRIVATE KEY"* ]]; then
  echo "GCP_SA_KEY debe ser la private_key del JSON de la cuenta de servicio (PEM PKCS8, «BEGIN PRIVATE KEY»)" >&2; exit 1
fi
if [ -n "${GCP_SA_EMAIL:-}" ] && [[ "$GCP_SA_EMAIL" != *@*gserviceaccount.com ]]; then
  echo "GCP_SA_EMAIL no parece una cuenta de servicio (…@….iam.gserviceaccount.com, el client_email del JSON)" >&2; exit 1
fi

auth() { printf 'header = "Authorization: Bearer %s"\n' "$CLOUDFLARE_API_TOKEN"; }   # printf es interno: no aparece en ps
cf() {  # cf METODO RUTA            (sin cuerpo)
  curl -sS -K <(auth) -X "$1" "$API$2"
}
cfj() { # cf METODO RUTA < JSON     (cuerpo por stdin)
  curl -sS -K <(auth) -X "$1" "$API$2" -H "Content-Type: application/json" --data-binary @-
}
py() { python3 -I -c "$1" "${@:2}"; }
# solo muestra código y mensaje de los errores de Cloudflare (nunca el cuerpo enviado)
ok() { py 'import json,sys
d=json.load(sys.stdin)
if not d.get("success"):
    sys.exit("  error: " + "; ".join("%s %s" % (e.get("code"), e.get("message")) for e in d.get("errors") or []))
print(sys.argv[1] if len(sys.argv)>1 else "  ok")' "$@"; }

echo "→ Comprobando el token…"
cf GET /user/tokens/verify | ok "  token activo"

echo "→ Zona $DOMAIN"
ZONE=$(cf GET "/zones?name=$DOMAIN" | py 'import json,sys; d=json.load(sys.stdin); r=d.get("result") or []; assert d.get("success") and r, ("zona no encontrada o sin permiso", d.get("errors")); print(r[0]["id"], r[0]["account"]["id"])')
read -r ZONE_ID ACCOUNT_ID <<<"$ZONE"
[ -n "${ZONE_ID:-}" ] && [ -n "${ACCOUNT_ID:-}" ] || { echo "No se pudo leer la zona $DOMAIN" >&2; exit 1; }
echo "  zona $ZONE_ID · cuenta $ACCOUNT_ID"

echo "→ Worker $SCRIPT_NAME ($PADDLE_ENV, precio $PADDLE_PRICE_ID, Firebase $PROJECT, CORS $SITE_ORIGINS, límite $RATE_LIMIT)"
# keep_bindings: los secretos ya guardados siguen (los nuevos se ponen en el paso siguiente). TEST_UIDS solo si viene
# (sin él el sandbox no da permisos). RATE_LIMIT: namespace propio de este Worker, 6 pedidos por minuto por clave
py 'import json,os
names=["PADDLE_ENV","PADDLE_PRICE_ID","FIREBASE_PROJECT","FIREBASE_API_KEY","SITE_ORIGINS"]
if os.environ["TEST_UIDS"]: names.append("TEST_UIDS")
b=[{"type":"plain_text","name":n,"text":os.environ[n]} for n in names]
if os.environ["RATE_LIMIT"]!="off":
    b.append({"type":"ratelimit","name":"RATE_LIMIT","namespace_id":"7301","simple":{"limit":6,"period":60}})
print(json.dumps({"main_module":"worker.js","compatibility_date":"2026-09-01","bindings":b,"keep_bindings":["secret_text"]}))' \
  | curl -sS -K <(auth) -X PUT "$API/accounts/$ACCOUNT_ID/workers/scripts/$SCRIPT_NAME" \
      -F "metadata=<-;type=application/json" -F "worker.js=@$WORKER;type=application/javascript+module" \
  | ok "  subido"

echo "→ Secretos"
for NAME in "${SECRETS[@]}"; do
  if [ -n "${!NAME:-}" ]; then
    export "${NAME?}"
    py 'import json,os,sys; print(json.dumps({"name":sys.argv[1],"text":os.environ[sys.argv[1]],"type":"secret_text"}))' "$NAME" \
      | cfj PUT "/accounts/$ACCOUNT_ID/workers/scripts/$SCRIPT_NAME/secrets" | ok "  + $NAME (actualizado)"
  else
    echo "  = $NAME (sin cambios)"
  fi
done
HAVE=$(cf GET "/accounts/$ACCOUNT_ID/workers/scripts/$SCRIPT_NAME/secrets" | py 'import json,sys
d=json.load(sys.stdin); assert d.get("success"), d.get("errors")
print(" ".join(s.get("name","") for s in d.get("result") or []))')
MISSING=""
for NAME in "${SECRETS[@]}"; do [[ " $HAVE " == *" $NAME "* ]] || MISSING="$MISSING $NAME"; done
[ -z "$MISSING" ] && echo "  todos guardados" || echo "  ! faltan:$MISSING (pásalos como variables de entorno y corre el script otra vez)"

echo "→ Ruta $DOMAIN/api/* → $SCRIPT_NAME"
PATTERN="$DOMAIN/api/*"
ROUTE_ID=$(cf GET "/zones/$ZONE_ID/workers/routes" | py 'import json,sys
d=json.load(sys.stdin); assert d.get("success"), d.get("errors")
print(next((r["id"] for r in d.get("result") or [] if r.get("pattern")==sys.argv[1]), ""))' "$PATTERN")
ROUTE_BODY=$(py 'import json,sys; print(json.dumps({"pattern":sys.argv[1],"script":sys.argv[2]}))' "$PATTERN" "$SCRIPT_NAME")
if [ -n "$ROUTE_ID" ]; then
  printf '%s' "$ROUTE_BODY" | cfj PUT "/zones/$ZONE_ID/workers/routes/$ROUTE_ID" | ok "  = ya existía (actualizada)"
else
  printf '%s' "$ROUTE_BODY" | cfj POST "/zones/$ZONE_ID/workers/routes" | ok "  + creada"
fi

echo "→ Comprobación: https://$DOMAIN/api/health"
GOOD=""
for i in $(seq 1 12); do
  HEALTH=$( { curl -sS --max-time 10 "https://$DOMAIN/api/health" 2>/dev/null || true; } )
  if printf '%s' "$HEALTH" | py 'import json,sys
try: d=json.load(sys.stdin)
except Exception: sys.exit(1)
sys.exit(0 if d.get("ok") is True and d.get("env")==sys.argv[1] else 1)' "$PADDLE_ENV"; then GOOD=1; break; fi
  sleep 5
done
echo "  ${HEALTH:-sin respuesta}"
[ -n "$GOOD" ] || { echo "El Worker no responde todavía en /api/health. Espera un minuto y vuelve a correr el script; si sigue igual, revisa la ruta en el panel de Cloudflare (y que el DNS de $DOMAIN tenga el proxy activo)." >&2; exit 1; }
[ -z "$MISSING" ] || exit 1

if [ "$PADDLE_ENV" = live ]; then
  CONFIG="  - js/cloud-config.js: pay.env = 'live', pay.priceId = '$PADDLE_PRICE_ID' y el token live_… (docs/PAGOS.md §6.3)."
else
  CONFIG="  - Solo en tu copia local de js/cloud-config.js (no lo subas: §5.1): pay.env = 'sandbox', pay.priceId = '$PADDLE_PRICE_ID' y el token test_…"
fi
cat <<MSG

Listo.
  - Destino del webhook: lo crea tools/setup-paddle.cjs; su PADDLE_WEBHOOK_SECRET va en este script (si lo perdiste:
    setup-paddle.cjs --show-secret y vuelve a correr este con esa variable y las obligatorias). No crees otro a mano.
$CONFIG
Los logs del Worker: Cloudflare → Workers & Pages → $SCRIPT_NAME → Logs (o «wrangler tail $SCRIPT_NAME»).
MSG
