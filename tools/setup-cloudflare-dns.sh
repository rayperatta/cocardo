#!/usr/bin/env bash
# Apunta el dominio (en Cloudflare) a GitHub Pages: registros A/AAAA del apex y CNAME de www, sin proxy
# («DNS only», nube gris) para que GitHub pueda emitir el certificado HTTPS. Es idempotente: crea lo que
# falta, corrige lo que apunta a otro lado y deja lo que ya está bien.
#
# Uso:  CLOUDFLARE_API_TOKEN=... tools/setup-cloudflare-dns.sh [dominio] [usuario-github] [token-verificacion]
#   dominio             por defecto cocardo.app
#   usuario-github      por defecto rayperatta (destino del CNAME www -> usuario.github.io)
#   token-verificacion  opcional: el valor del TXT _github-pages-challenge-<usuario> que da GitHub en
#                       Settings → Pages (verified domains), para blindar el dominio.
# Token: en Cloudflare → My Profile → API Tokens → Create Token → plantilla «Edit zone DNS», zona = el dominio.
set -euo pipefail

DOMAIN="${1:-cocardo.app}"
GH_USER="${2:-rayperatta}"
CHALLENGE="${3:-}"
: "${CLOUDFLARE_API_TOKEN:?Falta CLOUDFLARE_API_TOKEN (token con permiso Zone → DNS → Edit sobre $DOMAIN)}"
API="https://api.cloudflare.com/client/v4"

# Direcciones oficiales de GitHub Pages (docs.github.com → "Managing a custom domain for your GitHub Pages site")
A_RECORDS=(185.199.108.153 185.199.109.153 185.199.110.153 185.199.111.153)
AAAA_RECORDS=(2606:50c0:8000::153 2606:50c0:8001::153 2606:50c0:8002::153 2606:50c0:8003::153)

cf() {  # cf METODO RUTA [JSON]
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -sS -X "$method" "$API$path" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" --data "$body"
  else
    curl -sS -X "$method" "$API$path" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
  fi
}
# jq no está garantizado: se usa python3 para leer el JSON
py() { python3 -I -c "$1" "${@:2}"; }

echo "→ Comprobando el token…"
cf GET /user/tokens/verify | py 'import json,sys; d=json.load(sys.stdin); assert d.get("success"), d; print("  token", d["result"]["status"])'

echo "→ Buscando la zona $DOMAIN…"
ZONE_ID=$(cf GET "/zones?name=$DOMAIN" | py 'import json,sys; d=json.load(sys.stdin); r=d.get("result") or []; assert d.get("success") and r, ("zona no encontrada o sin permiso", d.get("errors")); print(r[0]["id"]); print("  estado:", r[0]["status"], file=sys.stderr)')

RECORDS=$(cf GET "/zones/$ZONE_ID/dns_records?per_page=500")

# ensure TIPO NOMBRE CONTENIDO  -> crea el registro si no existe (mismo tipo+nombre+contenido) y lo pone sin proxy
ensure() {
  local type="$1" name="$2" content="$3"
  local id
  id=$(printf '%s' "$RECORDS" | py 'import json,sys
t,n,c=sys.argv[1:4]
for r in json.load(sys.stdin)["result"]:
    if r["type"]==t and r["name"]==n and r["content"].lower()==c.lower(): print(r["id"]); break' "$type" "$name" "$content")
  if [ -n "$id" ]; then
    cf PATCH "/zones/$ZONE_ID/dns_records/$id" "{\"proxied\":false,\"ttl\":1}" | py 'import json,sys; d=json.load(sys.stdin); assert d.get("success"), d; print("  =", d["result"]["type"], d["result"]["name"], "->", d["result"]["content"], "(ya estaba; sin proxy)")'
  else
    cf POST "/zones/$ZONE_ID/dns_records" "{\"type\":\"$type\",\"name\":\"$name\",\"content\":\"$content\",\"proxied\":false,\"ttl\":1}" | py 'import json,sys; d=json.load(sys.stdin); assert d.get("success"), d; print("  +", d["result"]["type"], d["result"]["name"], "->", d["result"]["content"])'
  fi
}
# remove_others TIPO NOMBRE CONTENIDOS…  -> borra registros de ese tipo+nombre que apunten a otro lado (apex solo a Pages)
remove_others() {
  local type="$1" name="$2"; shift 2
  local keep="$*"
  printf '%s' "$RECORDS" | py 'import json,sys
t,n=sys.argv[1:3]; keep=set(x.lower() for x in sys.argv[3].split())
for r in json.load(sys.stdin)["result"]:
    if r["type"]==t and r["name"]==n and r["content"].lower() not in keep: print(r["id"], r["content"])' "$type" "$name" "$keep" | while read -r id content; do
    [ -z "$id" ] && continue
    cf DELETE "/zones/$ZONE_ID/dns_records/$id" >/dev/null && echo "  - $type $name -> $content (apuntaba a otro lado)"
  done
}

echo "→ Registros del apex ($DOMAIN) → GitHub Pages"
for ip in "${A_RECORDS[@]}"; do ensure A "$DOMAIN" "$ip"; done
for ip in "${AAAA_RECORDS[@]}"; do ensure AAAA "$DOMAIN" "$ip"; done
remove_others A "$DOMAIN" "${A_RECORDS[@]}"
remove_others AAAA "$DOMAIN" "${AAAA_RECORDS[@]}"
# un CNAME en el apex chocaría con los A: si existe (p. ej. el del registrador), se quita
remove_others CNAME "$DOMAIN" ""

echo "→ www.$DOMAIN → $GH_USER.github.io"
ensure CNAME "www.$DOMAIN" "$GH_USER.github.io"

if [ -n "$CHALLENGE" ]; then
  echo "→ TXT de verificación del dominio en GitHub"
  ensure TXT "_github-pages-challenge-$GH_USER.$DOMAIN" "$CHALLENGE"
fi

echo "→ Comprobación pública (DNS de Google)"
for t in A AAAA; do
  curl -sS "https://dns.google/resolve?name=$DOMAIN&type=$t" | py 'import json,sys; d=json.load(sys.stdin); print("  ", sys.argv[1], sorted(a["data"] for a in d.get("Answer",[])) or "(aún no se ve; puede tardar unos minutos)")' "$t"
done
curl -sS "https://dns.google/resolve?name=www.$DOMAIN&type=CNAME" | py 'import json,sys; d=json.load(sys.stdin); print("   CNAME www:", [a["data"] for a in d.get("Answer",[])] or "(aún no se ve)")'
cat <<MSG

Listo. Siguiente paso en GitHub (una sola vez): Settings → Pages → Custom domain = $DOMAIN → Save.
Si el repositorio ya tiene el archivo CNAME en la rama publicada, GitHub lo toma solo. El certificado HTTPS
tarda entre unos minutos y una hora; cuando «Enforce HTTPS» se pueda marcar, márcalo. Comprueba con:
  curl -I https://$DOMAIN/
MSG
