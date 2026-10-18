#!/bin/sh
# Aplica patches/<target>/*.patch sobre el código de upstream, que en git queda
# siempre igual a upstream:
#   voyager -> source/voyager (submódulo)
#   ecorpus -> raíz del repo (archivos de upstream en source/)
#
# Pensado para que una actualización de upstream NUNCA pierda un parche en
# silencio:
#   - si un parche no aplica limpio (fuzz 0), el script falla => el build falla;
#   - si ya estaba aplicado (re-ejecución local), lo detecta y lo salta;
#   - --check solo verifica, sin modificar archivos;
#   - --revert deshace los parches aplicados (deja source/ como en git);
#   - --strict falla si un parche ya estaba aplicado (CI: source/ commiteado
#     con el parche dentro).
#
# Uso: scripts/apply-patches.sh [--check|--revert] [--strict] <voyager|ecorpus> [DIR]
set -eu

mode=apply
strict=""
while :; do
  case "${1:-}" in
    --check) mode=check; shift ;;
    --revert) mode=revert; shift ;;
    --strict) strict=1; shift ;;
    *) break ;;
  esac
done

root=$(cd "$(dirname "$0")/.." && pwd)
target=${1:-}
case "$target" in
  voyager)
    dir=${2:-"$root/source/voyager"}
    [ -d "$dir/source" ] || { echo "ERROR: $dir no parece un checkout de Voyager (¿submódulo sin inicializar?)" >&2; exit 1; }
    ;;
  ecorpus)
    dir=${2:-"$root"}
    [ -d "$dir/source/server" ] || { echo "ERROR: $dir no parece un checkout de eCorpus" >&2; exit 1; }
    ;;
  *) echo "Uso: $0 [--check|--revert] [--strict] <voyager|ecorpus> [DIR]" >&2; exit 2 ;;
esac
patch_dir="$root/patches/$target"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# --binary: sin conversión de finales de línea, igual en GNU patch de Linux y de Git Bash.
opts="-p1 -d $dir --fuzz=0 --binary --no-backup-if-mismatch -s -f"

status=0
# Se revierten en orden inverso: un parche puede apoyarse en otro anterior sobre el mismo archivo.
patches=$(ls "$patch_dir"/*.patch 2>/dev/null | sort)
[ "$mode" = revert ] && patches=$(printf '%s
' "$patches" | sort -r)
for p in $patches; do
  [ -e "$p" ] || continue
  name=$(basename "$p")
  # Los parches se guardan en LF. Un checkout de Windows (core.autocrlf=true)
  # deja el código en CRLF, y GNU patch en Linux rechaza la mezcla
  # ("different line endings"): se prueba también una copia CRLF del parche.
  sed 's/$/\r/' "$p" > "$tmp/$name.crlf"
  done=""
  for variant in "$p" "$tmp/$name.crlf"; do
    if patch $opts --dry-run < "$variant" >/dev/null 2>&1; then
      case "$mode" in
        check) echo "OK      $name aplica limpio" ;;
        apply) patch $opts < "$variant"; echo "APLICADO $name" ;;
        revert) echo "NO ESTÁ $name (nada que revertir)" ;;
      esac
      done=1; break
    elif patch $opts --dry-run -R < "$variant" >/dev/null 2>&1; then
      if [ "$mode" = revert ]; then
        patch $opts -R < "$variant"; echo "REVERTIDO $name"
      elif [ -n "$strict" ]; then
        echo "ERROR   $name ya está aplicado: source/ no debe commitearse parchado (scripts/apply-patches.sh --revert $target)" >&2
        status=1
      else
        echo "YA ESTÁ $name"
      fi
      done=1; break
    fi
  done
  if [ -z "$done" ]; then
    echo "ERROR   $name no aplica sobre $target: upstream cambió esas líneas; regenerarlo (skill upstream-patches)" >&2
    echo "        detalle (dry-run):" >&2
    # Mostrar la variante (LF o CRLF) que coincide con los finales de línea del
    # código: la otra marcaría como fallidos todos los hunks.
    patch $opts --dry-run < "$p" > "$tmp/lf.out" 2>&1 || true
    patch $opts --dry-run < "$tmp/$name.crlf" > "$tmp/crlf.out" 2>&1 || true
    if [ "$(grep -c FAILED "$tmp/crlf.out")" -lt "$(grep -c FAILED "$tmp/lf.out")" ]; then
      cat "$tmp/crlf.out" >&2
    else
      cat "$tmp/lf.out" >&2
    fi
    status=1
  fi
done
exit $status
