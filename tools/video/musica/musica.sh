#!/usr/bin/env bash
# Lanzador de la música del estudio: corre generar.py, revisar.py o elegir.py en el venv de ACE-Step, con las cachés
# fuera del repo (~/.local/share/cocardo-estudio/) y sin __pycache__. generar y revisar toman solos el candado de la
# GPU: no lo envuelvas en flock.
#   tools/video/musica/musica.sh generar [pedidos.json] [--solo tema-1,drama-2] [--forzar]
#   tools/video/musica/musica.sh revisar [pedidos.json] [--solo tema-1]
#   tools/video/musica/musica.sh elegir [tema=tema-4 …] [--aplicar elegidas.json] [--medidas]
set -euo pipefail
E="$HOME/.local/share/cocardo-estudio"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY="$E/musica/venv/bin/python"
case "${1:-}" in
  generar|revisar|elegir) ORDEN="$1"; shift ;;
  *) sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac
[ -x "$PY" ] || { echo "Falta el venv de música en $E/musica/venv" >&2; exit 1; }
export PYTHONDONTWRITEBYTECODE=1 HF_HOME="$E/hf" ACESTEP_PROJECT_ROOT="$E/musica" TORCH_HOME="$E/musica/torch-hub"
exec "$PY" "$AQUI/$ORDEN.py" "$@"
