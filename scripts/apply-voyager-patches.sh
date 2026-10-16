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

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# --binary: sin conversión de finales de línea, igual en GNU patch de Linux y de Git Bash.
opts="-p1 -d $voyager_dir --fuzz=0 --binary --no-backup-if-mismatch -s -f"

status=0
for p in "$patch_dir"/*.patch; do
  [ -e "$p" ] || continue
  name=$(basename "$p")
  # Los parches se guardan en LF. Un checkout de Windows (core.autocrlf=true)
  # deja Voyager en CRLF, y GNU patch en Linux rechaza la mezcla
  # ("different line endings"): se prueba también una copia CRLF del parche.
  sed 's/$/\r/' "$p" > "$tmp/$name.crlf"
  applied=""
  for variant in "$p" "$tmp/$name.crlf"; do
    if patch $opts --dry-run < "$variant" >/dev/null 2>&1; then
      if [ "$mode" = check ]; then
        echo "OK      $name aplica limpio"
      else
        patch $opts < "$variant"
        echo "APLICADO $name"
      fi
      applied=1; break
    elif patch $opts --dry-run -R < "$variant" >/dev/null 2>&1; then
      echo "YA ESTÁ $name"
      applied=1; break
    fi
  done
  if [ -z "$applied" ]; then
    echo "ERROR   $name no aplica sobre Voyager: upstream cambió esas líneas; regenerarlo (ver docs/customization.md)" >&2
    echo "        detalle (dry-run):" >&2
    patch $opts --dry-run < "$p" >&2 || true
    status=1
  fi
done
exit $status
