#!/bin/sh
# Aplica patches/voyager/*.patch sobre source/voyager (submódulo sin tocar en git).
#
# Pensado para que una actualización de upstream NUNCA pierda el parche en
# silencio:
#   - si un parche no aplica limpio (fuzz 0), el script falla => el build falla;
#   - si ya estaba aplicado (re-ejecución local), lo detecta y lo salta;
#   - --check solo verifica, sin modificar archivos.
#
# Uso: scripts/apply-voyager-patches.sh [--check] [VOYAGER_DIR]
set -eu

mode=apply
if [ "${1:-}" = "--check" ]; then mode=check; shift; fi

root=$(cd "$(dirname "$0")/.." && pwd)
voyager_dir=${1:-"$root/source/voyager"}
patch_dir="$root/patches/voyager"

[ -d "$voyager_dir/source" ] || { echo "ERROR: $voyager_dir no parece un checkout de Voyager (¿submódulo sin inicializar?)" >&2; exit 1; }

status=0
for p in "$patch_dir"/*.patch; do
  [ -e "$p" ] || continue
  name=$(basename "$p")
  # -l: tolera CRLF de un checkout de Windows (core.autocrlf) frente a un parche LF.
  opts="-p1 -d $voyager_dir --fuzz=0 -l --no-backup-if-mismatch -s"
  if patch $opts --dry-run -f < "$p" >/dev/null 2>&1; then
    if [ "$mode" = check ]; then
      echo "OK      $name aplica limpio"
    else
      patch $opts -f < "$p"
      echo "APLICADO $name"
    fi
  elif patch $opts --dry-run -R -f < "$p" >/dev/null 2>&1; then
    echo "YA ESTÁ $name"
  else
    echo "ERROR   $name no aplica sobre Voyager: upstream cambió esas líneas; regenerarlo (ver docs/customization.md)" >&2
    status=1
  fi
done
exit $status
