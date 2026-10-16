#!/usr/bin/env bash
# Postiz guarda la dirección completa de cada video e imagen (por ejemplo
# http://localhost:4007/uploads/...). Después de mudarte al VPS, este script cambia esas
# direcciones en la base de datos a la POSTIZ_URL nueva del .env.
# Uso: scripts/cambiar-url.sh <URL vieja>     Ejemplo: scripts/cambiar-url.sh http://localhost:4007
set -euo pipefail
cd "$(dirname "$0")/.."

vieja="${1:?Uso: scripts/cambiar-url.sh <URL vieja, por ejemplo http://localhost:4007>}"
vieja="${vieja%/}"
nueva="$(grep -E '^POSTIZ_URL=' .env | cut -d= -f2-)"
nueva="${nueva%/}"

if [ -z "$nueva" ] || [ "$vieja" = "$nueva" ]; then
  echo "POSTIZ_URL en .env es '$nueva': no hay nada que cambiar." >&2
  exit 1
fi

echo "Cambiando $vieja -> $nueva en la base de datos..."
docker compose up -d --wait postiz-postgres >/dev/null
docker compose exec -T postiz-postgres \
  psql -U postiz-user -d postiz-db -v ON_ERROR_STOP=1 -v vieja="$vieja" -v nueva="$nueva" <<'SQL'
BEGIN;
UPDATE "Media"        SET path     = replace(path,     :'vieja', :'nueva') WHERE strpos(path,     :'vieja') > 0;
UPDATE "Post"         SET image    = replace(image,    :'vieja', :'nueva') WHERE strpos(image,    :'vieja') > 0;
UPDATE "Post"         SET settings = replace(settings, :'vieja', :'nueva') WHERE strpos(settings, :'vieja') > 0;
UPDATE "Post"         SET content  = replace(content,  :'vieja', :'nueva') WHERE strpos(content,  :'vieja') > 0;
UPDATE "Integration"  SET picture  = replace(picture,  :'vieja', :'nueva') WHERE strpos(picture,  :'vieja') > 0;
UPDATE "ClippingClip" SET path     = replace(path,     :'vieja', :'nueva') WHERE strpos(path,     :'vieja') > 0;
COMMIT;
SQL
echo "Listo. Arranca o reinicia Postiz con: docker compose up -d"
