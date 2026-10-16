#!/usr/bin/env bash
# Aprovisiona la nube del juego sin pasar por la consola (salvo dos clics, ver abajo):
#   1. proyecto de Firebase (lo crea si no existe)      4. base de datos Firestore (si no existe)
#   2. app web y su configuración → js/cloud-config.js   5. reglas e índices de Firestore (firebase/)
#   3. (opcional) dominio y redes en js/cloud-config.js  6. Authentication: proveedor «Anónimo» y dominios autorizados
# Lo único que Google no deja hacer por API es activar el proveedor **Google** (necesita crear un cliente OAuth):
# Firebase console → Authentication → Sign-in method → Google → Enable → Save. El script lo comprueba y avisa.
#
# Credenciales (una de las tres):
#   sesión de `firebase login`       la de tu computadora (la más simple: `npx firebase-tools@15 login` una vez).
#   FIREBASE_TOKEN                   token de `firebase login:ci` (actúa como tu usuario: puede crear el proyecto).
#                                    Está marcado como «deprecated» en la CLI, pero sigue funcionando en la v15.
#   GOOGLE_APPLICATION_CREDENTIALS   ruta a un JSON de cuenta de servicio con rol Editor/Owner en un proyecto YA creado
#                                    (una cuenta de servicio no puede crear proyectos en una cuenta Gmail sin organización).
# Requisitos: Node 18+, npx (descarga firebase-tools si no está), python3, curl. gcloud solo con cuenta de servicio.
#
# Uso: tools/setup-firebase.sh [projectId] [nombre] [ubicación] [dominios autorizados extra, separados por coma]
#   p. ej.  FIREBASE_TOKEN=... tools/setup-firebase.sh cocardo-rescate "Cocardo Rescate Helado" southamerica-east1 cocardo.app,www.cocardo.app,rayperatta.github.io
set -euo pipefail

PID="${1:-cocardo-rescate}"
NAME="${2:-Cocardo Rescate Helado}"
LOCATION="${3:-southamerica-east1}"
EXTRA_DOMAINS="${4:-cocardo.app,www.cocardo.app,rayperatta.github.io}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FB="${FIREBASE_BIN:-}"
if [ -z "$FB" ]; then
  if command -v firebase >/dev/null 2>&1; then FB="firebase"; else FB="npx --yes firebase-tools@15"; fi
fi
py() { python3 -I -c "$1" "${@:2}"; }
# Sesión de `firebase login`: la CLI guarda ahí su refresh token; se usa igual que el de login:ci
FB_STORE="${XDG_CONFIG_HOME:-$HOME/.config}/configstore/firebase-tools.json"
LOGIN_TOKEN=""
if [ -z "${FIREBASE_TOKEN:-}" ] && [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ] && [ -f "$FB_STORE" ]; then
  LOGIN_TOKEN=$(py 'import json,sys; print((json.load(open(sys.argv[1])).get("tokens") or {}).get("refresh_token",""))' "$FB_STORE" 2>/dev/null || true)
fi
if [ -z "${FIREBASE_TOKEN:-}" ] && [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ] && [ -z "$LOGIN_TOKEN" ]; then
  echo "Falta una credencial: inicia sesión con 'npx firebase-tools@15 login', o usa FIREBASE_TOKEN (de 'firebase login:ci') o GOOGLE_APPLICATION_CREDENTIALS (JSON de cuenta de servicio)." >&2
  exit 2
fi
fb() { $FB "$@" --non-interactive; }

echo "→ Proyecto $PID"
if fb projects:list --json 2>/dev/null | py 'import json,sys; d=json.load(sys.stdin); ids=[p.get("projectId") for p in (d.get("result") or [])]; sys.exit(0 if sys.argv[1] in ids else 1)' "$PID"; then
  echo "  ya existe"
else
  if [ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" ] && [ -z "${FIREBASE_TOKEN:-}" ]; then
    echo "  El proyecto no existe y una cuenta de servicio no puede crearlo. Créalo en https://console.firebase.google.com (nombre: $PID) y vuelve a correr el script." >&2
    exit 3
  fi
  fb projects:create "$PID" -n "$NAME" --json | py 'import json,sys; d=json.load(sys.stdin); print("  creado:", (d.get("result") or {}).get("projectId") or d)'
fi

echo "→ App web"
APP_ID=$(fb apps:list WEB -P "$PID" --json | py 'import json,sys
d=json.load(sys.stdin); apps=d.get("result") or []
pref=[a for a in apps if (a.get("displayName") or "")==sys.argv[1]]
a=(pref or apps or [None])[0]
print(a["appId"] if a else "")' "$NAME web")
if [ -z "$APP_ID" ]; then
  APP_ID=$(fb apps:create WEB "$NAME web" -P "$PID" --json | py 'import json,sys; d=json.load(sys.stdin); r=d.get("result") or {}; print(r.get("appId") or "")')
  echo "  creada: $APP_ID"
else
  echo "  ya existe: $APP_ID"
fi
[ -n "$APP_ID" ] || { echo "No se pudo obtener el appId" >&2; exit 4; }

echo "→ Configuración del SDK → js/cloud-config.js"
fb apps:sdkconfig WEB "$APP_ID" -P "$PID" --json > /tmp/cocardo-sdkconfig.json
py '
import json,re,sys
raw=json.load(open("/tmp/cocardo-sdkconfig.json"))
def find(o):
    if isinstance(o,dict):
        if "apiKey" in o and "projectId" in o: return o
        for v in o.values():
            r=find(v)
            if r: return r
    if isinstance(o,list):
        for v in o:
            r=find(v)
            if r: return r
    return None
cfg=find(raw)
assert cfg, ("sin sdkConfig en la salida", raw)
path=sys.argv[1]; s=open(path,encoding="utf-8").read()
for k in ("apiKey","authDomain","projectId","appId"):
    v=cfg.get(k,"")
    s,n=re.subn(r"(\b%s:\s*)\x27[^\x27]*\x27" % k, lambda m: m.group(1)+"\x27"+v+"\x27", s, count=1)
    assert n==1, "no se encontró el campo "+k
extra=sys.argv[2].split(",")[0].strip()
if extra and "siteUrl: \x27\x27" in s:
    s=s.replace("siteUrl: \x27\x27", "siteUrl: \x27https://%s/\x27" % extra, 1)
open(path,"w",encoding="utf-8").write(s)
print("  apiKey:", cfg["apiKey"][:10]+"…", "projectId:", cfg["projectId"], "appId:", cfg["appId"])
' "$ROOT/js/cloud-config.js" "$EXTRA_DOMAINS"

echo "→ Firestore"
if fb firestore:databases:list -P "$PID" --json 2>/dev/null | py 'import json,sys; d=json.load(sys.stdin); names=[x.get("name","") for x in (d.get("result") or [])]; sys.exit(0 if any(n.endswith("/(default)") for n in names) else 1)'; then
  echo "  base (default) ya existe"
else
  fb firestore:databases:create "(default)" --location "$LOCATION" -P "$PID" | sed 's/^/  /'
fi

echo "→ Reglas e índices"
( cd "$ROOT/firebase" && $FB deploy --only firestore:rules,firestore:indexes -P "$PID" --non-interactive --force | sed 's/^/  /' )

echo "→ Authentication (API Identity Toolkit)"
if [ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]; then
  gcloud auth activate-service-account --key-file="$GOOGLE_APPLICATION_CREDENTIALS" --quiet >/dev/null 2>&1 || true
  ACCESS=$(gcloud auth print-access-token 2>/dev/null || true)
else
  # el token de login:ci (o el de `firebase login`) es un refresh token de la CLI oficial: se cambia por un access
  # token con su cliente público
  ACCESS=$(curl -sS -X POST https://oauth2.googleapis.com/token \
    -d "client_id=${FIREBASE_CLIENT_ID:-563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com}" \
    -d "client_secret=${FIREBASE_CLIENT_SECRET:-j9iVZfS8kkCEFUPaAeJV0sAi}" \
    -d "refresh_token=${FIREBASE_TOKEN:-$LOGIN_TOKEN}" -d "grant_type=refresh_token" | py 'import json,sys; print(json.load(sys.stdin).get("access_token",""))')
fi
if [ -z "$ACCESS" ]; then
  echo "  (sin access token: activa en la consola Authentication → Sign-in method → Anonymous y añade los dominios autorizados)"
else
  IT="https://identitytoolkit.googleapis.com/admin/v2/projects/$PID/config"
  CUR=$(curl -sS "$IT" -H "Authorization: Bearer $ACCESS")
  if printf '%s' "$CUR" | py 'import json,sys; d=json.load(sys.stdin); sys.exit(1 if "error" in d else 0)'; then
    BODY=$(printf '%s' "$CUR" | py 'import json,sys
d=json.load(sys.stdin); pid=sys.argv[1]; extra=[x.strip() for x in sys.argv[2].split(",") if x.strip()]
doms=list(d.get("authorizedDomains") or [])
for x in ["localhost", pid+".firebaseapp.com", pid+".web.app"]+extra:
    if x not in doms: doms.append(x)
print(json.dumps({"signIn":{"anonymous":{"enabled":True}},"authorizedDomains":doms}))' "$PID" "$EXTRA_DOMAINS")
    curl -sS -X PATCH "$IT?updateMask=signIn.anonymous.enabled,authorizedDomains" -H "Authorization: Bearer $ACCESS" -H "Content-Type: application/json" --data "$BODY" \
      | py 'import json,sys; d=json.load(sys.stdin); assert "error" not in d, d; print("  anónimo:", d.get("signIn",{}).get("anonymous",{}).get("enabled"), "| dominios:", ", ".join(d.get("authorizedDomains",[])))'
    GOOGLE_ON=$(curl -sS "https://identitytoolkit.googleapis.com/admin/v2/projects/$PID/defaultSupportedIdpConfigs" -H "Authorization: Bearer $ACCESS" | py 'import json,sys; d=json.load(sys.stdin); c=[x for x in d.get("defaultSupportedIdpConfigs",[]) if x.get("name","").endswith("/google.com")]; print("si" if c and c[0].get("enabled") else "no")')
    if [ "$GOOGLE_ON" = "si" ]; then echo "  Google: activado"; else
      echo "  Google: PENDIENTE (2 clics) → https://console.firebase.google.com/project/$PID/authentication/providers → Google → Enable → Save"
    fi
  else
    echo "  Authentication aún no está inicializado en este proyecto. Un clic: https://console.firebase.google.com/project/$PID/authentication → Get started; luego vuelve a correr el script."
    printf '%s\n' "$CUR" | head -c 300; echo
  fi
fi

cat <<MSG

Listo. Revisa js/cloud-config.js (ya tiene la configuración) y súbelo al repositorio. Comprueba en el juego por https://
Consola del proyecto: https://console.firebase.google.com/project/$PID/overview
MSG
