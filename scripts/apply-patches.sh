#!/bin/sh
# Aplica patches/<target>/*.patch sobre el código de upstream, que en git queda
# siempre igual a upstream:
#   voyager -> source/voyager (submódulo)
#   ecorpus -> raíz del repo (archivos de upstream en source/)
#
# Pensado para que una actualización de upstream NUNCA pierda un parche en
# silencio:
#   - si un parche no aplica limpio (fuzz 0), el script falla => el build falla;
#   - si ya estaba aplicado (re-ejecución local), lo detecta (YA ESTÁ), también
#     con parches encadenados sobre el mismo archivo;
#   - --check solo verifica (en orden, sobre una copia), sin modificar archivos;
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

# --check trabaja sobre una copia de los archivos que tocan los parches y los aplica en orden: un parche puede
# apoyarse en otro anterior sobre el mismo archivo (0005 sobre 0003), y probarlos sueltos lo daría por roto.
if [ "$mode" = check ]; then
  mkdir "$tmp/tree"
  for f in $(sed -n 's|^diff --git a/\([^ ]*\) b/.*|\1|p' "$patch_dir"/*.patch | sort -u); do
    [ -e "$dir/$f" ] || continue
    mkdir -p "$tmp/tree/$(dirname "$f")"
    cp -p "$dir/$f" "$tmp/tree/$f"
  done
  dir="$tmp/tree"
fi

# --binary: sin conversión de finales de línea, igual en GNU patch de Linux y de Git Bash.
opts="-p1 -d $dir --fuzz=0 --binary --no-backup-if-mismatch -s -f"

status=0
patches=$(ls "$patch_dir"/*.patch 2>/dev/null | sort)
reversed=$(printf '%s\n' "$patches" | sort -r)

# Los parches se guardan en LF. Un checkout de Windows (core.autocrlf=true) deja el código en CRLF, y GNU patch en
# Linux rechaza la mezcla ("different line endings"): se prueba también una copia CRLF de cada parche.
for p in $patches; do
  sed 's/$/\r/' "$p" > "$tmp/$(basename "$p").crlf"
done

# Un parche puede apoyarse en otro anterior sobre el mismo archivo (0005 sobre 0003): con varios ya aplicados, el de
# abajo no se puede reconocer ni deshacer mientras el de arriba siga puesto. Por eso primero se deshacen los aplicados
# en orden inverso (anotándolos) y después se aplica en orden. --revert se queda en ese primer paso.
was_applied=" "
for p in $reversed; do
  [ -e "$p" ] || continue
  name=$(basename "$p")
  for variant in "$p" "$tmp/$name.crlf"; do
    if patch $opts --dry-run -R < "$variant" >/dev/null 2>&1 && ! patch $opts --dry-run < "$variant" >/dev/null 2>&1; then
      patch $opts -R < "$variant"
      was_applied="$was_applied$name "
      [ "$mode" = revert ] && echo "REVERTIDO $name"
      break
    fi
  done
  if [ "$mode" = revert ] && [ "${was_applied#* $name }" = "$was_applied" ]; then
    echo "NO ESTÁ $name (nada que revertir)"
  fi
done
[ "$mode" = revert ] && exit 0

for p in $patches; do
  [ -e "$p" ] || continue
  name=$(basename "$p")
  done=""
  for variant in "$p" "$tmp/$name.crlf"; do
    if patch $opts --dry-run < "$variant" >/dev/null 2>&1; then
      patch $opts < "$variant"
      if [ "${was_applied#* $name }" != "$was_applied" ]; then
        if [ -n "$strict" ]; then
          echo "ERROR   $name ya está aplicado: source/ no debe commitearse parchado (scripts/apply-patches.sh --revert $target)" >&2
          status=1
        else
          echo "YA ESTÁ $name"
        fi
      elif [ "$mode" = check ]; then
        echo "OK      $name aplica limpio"
      else
        echo "APLICADO $name"
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
