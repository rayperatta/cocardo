#!/usr/bin/env bash
# Guarda todos los datos de Postiz (cuentas conectadas, publicaciones, videos subidos, colas de
# Temporal) y el .env en redes/respaldos/<fecha>/. Sirve como copia de seguridad y para mudarse
# al VPS. Detiene Postiz mientras copia, para que las bases de datos queden enteras.
set -euo pipefail
cd "$(dirname "$0")/.."

proyecto=postiz
destino="respaldos/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$destino"
destino_abs="$(cd "$destino" && pwd)"

estaba_corriendo=$(docker compose ps -q)
if [ -n "$estaba_corriendo" ]; then
  echo "Deteniendo Postiz para copiar los datos..."
  docker compose stop
fi

for vol in $(docker compose config --volumes); do
  if docker volume inspect "${proyecto}_${vol}" >/dev/null 2>&1; then
    echo "Copiando ${vol}..."
    docker run --rm \
      -v "${proyecto}_${vol}:/datos:ro" \
      -v "${destino_abs}:/respaldo" \
      alpine:3.22 tar czf "/respaldo/${vol}.tar.gz" -C /datos .
  fi
done

cp .env "$destino/env"
chmod 600 "$destino/env"

if [ -n "$estaba_corriendo" ]; then
  echo "Arrancando Postiz de nuevo..."
  docker compose start
fi

echo
echo "Respaldo listo en redes/$destino ($(du -sh "$destino" | cut -f1))."
echo "Incluye tus contraseñas (archivo env): guárdalo en un lugar privado."
