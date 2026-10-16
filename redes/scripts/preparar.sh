#!/usr/bin/env bash
# Crea redes/.env a partir de .env.example con contraseñas nuevas.
# Si .env ya existe no lo toca: sus contraseñas son las que tienen las bases de datos.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo "Falta Docker con 'docker compose'. Instálalo primero (README.md, paso 1)." >&2
  exit 1
fi

if [ -f .env ]; then
  echo ".env ya existe, no lo cambio. Arranca con: docker compose up -d"
  exit 0
fi

secreto() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1"
  else
    head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

cp .env.example .env
# -i.bak funciona igual con el sed de Linux y el de macOS.
sed -i.bak \
  -e "s|^JWT_SECRET=.*|JWT_SECRET=$(secreto 32)|" \
  -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(secreto 24)|" \
  -e "s|^TEMPORAL_DB_PASSWORD=.*|TEMPORAL_DB_PASSWORD=$(secreto 24)|" \
  .env
rm -f .env.bak
chmod 600 .env

echo "Listo: .env creado con contraseñas nuevas."
echo "Arranca con:  docker compose up -d"
echo "Y abre:       http://localhost:4007  (la primera vez tarda unos minutos)"
