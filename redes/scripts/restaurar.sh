#!/usr/bin/env bash
# Carga un respaldo hecho con respaldar.sh. Uso:  scripts/restaurar.sh respaldos/20261016-203000
# Pensado para una instalación nueva (por ejemplo el VPS): no pisa datos que ya existan.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ $# -ne 1 ] || [ ! -d "$1" ]; then
  echo "Uso: scripts/restaurar.sh <carpeta del respaldo>" >&2
  exit 1
fi
shopt -s nullglob
origen_abs="$(cd "$1" && pwd)"
proyecto=postiz
archivos=("$origen_abs"/*.tar.gz)
if [ ${#archivos[@]} -eq 0 ] || [ ! -f "$origen_abs/env" ]; then
  echo "En $1 no hay un respaldo completo (faltan los .tar.gz o el archivo env)." >&2
  exit 1
fi

if [ -n "$(docker compose ps -aq 2>/dev/null)" ]; then
  echo "Postiz tiene contenedores creados. Bájalos primero con: docker compose down" >&2
  exit 1
fi

# Revisar todo antes de tocar nada.
for archivo in "${archivos[@]}"; do
  vol="$(basename "$archivo" .tar.gz)"
  if docker volume inspect "${proyecto}_${vol}" >/dev/null 2>&1; then
    contenido=$(docker run --rm -v "${proyecto}_${vol}:/datos:ro" alpine:3.22 ls -A /datos)
    if [ -n "$contenido" ]; then
      echo "El volumen ${proyecto}_${vol} ya tiene datos y no lo voy a pisar." >&2
      echo "Si de verdad quieres reemplazarlo todo: docker compose down -v (borra los datos actuales)." >&2
      exit 1
    fi
  fi
done

for archivo in "${archivos[@]}"; do
  vol="$(basename "$archivo" .tar.gz)"
  echo "Restaurando ${vol}..."
  docker volume create \
    --label com.docker.compose.project="$proyecto" \
    --label com.docker.compose.volume="$vol" \
    "${proyecto}_${vol}" >/dev/null
  docker run --rm \
    -v "${proyecto}_${vol}:/datos" \
    -v "${origen_abs}:/respaldo:ro" \
    alpine:3.22 tar xzf "/respaldo/${vol}.tar.gz" -C /datos
done

if [ ! -f .env ]; then
  cp "$origen_abs/env" .env
  chmod 600 .env
  echo
  echo "Copié el .env del respaldo (las contraseñas tienen que ser las mismas que en las bases)."
  echo "Si esto es el VPS, cambia en .env: POSTIZ_URL, COMPOSE_PROFILES=vps y POSTIZ_DOMINIO."
else
  echo
  echo "Ya había un .env y lo dejé. Revisa que JWT_SECRET, POSTGRES_PASSWORD y"
  echo "TEMPORAL_DB_PASSWORD sean iguales a los del archivo env del respaldo."
fi
echo "Después: docker compose up -d"
