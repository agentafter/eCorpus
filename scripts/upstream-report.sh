#!/bin/sh
# Informe de solo lectura: ¿qué rompería sincronizar con upstream/main?
# No toca el árbol de trabajo ni las ramas (solo `git fetch`); prueba los
# parches sobre copias temporales del código de upstream.
#
#   VERDE    sin nada que revisar
#   AMARILLO hay que revisar a mano (overlays, migraciones, Voyager nuevo)
#   ROJO     un parche no aplica o upstream toca un archivo que agregamos
#
# Uso: scripts/upstream-report.sh [--no-fetch] [REF]   (REF por defecto: upstream/main)
# Sale con 1 si hay algo en ROJO.
set -eu

fetch=1
if [ "${1:-}" = "--no-fetch" ]; then fetch=""; shift; fi
ref=${1:-upstream/main}

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

red=0; yellow=0
rojo() { echo "ROJO     $*"; red=1; }
amarillo() { echo "AMARILLO $*"; yellow=1; }
verde() { echo "VERDE    $*"; }
indent() { sed 's/^/           /'; }

if [ -n "$fetch" ]; then git fetch -q upstream; fi
base=$(git merge-base HEAD "$ref")
new=$(git rev-list --count "HEAD..$ref")
echo "Informe de sincronización: HEAD $(git rev-parse --short HEAD) contra $ref $(git rev-parse --short "$ref") ($(git log -1 --format=%cs "$ref"))"
echo "Base común: $(git rev-parse --short "$base") ($(git log -1 --format=%cs "$base")), commits nuevos en upstream: $new"
echo

# --- 1. Parches de eCorpus sobre el código de upstream ---
mkdir "$tmp/ecorpus"
git archive "$ref" source/server source/ui | tar -x -C "$tmp/ecorpus"
if out=$(sh scripts/apply-patches.sh --check ecorpus "$tmp/ecorpus" 2>&1); then
  verde "patches/ecorpus aplican sobre $ref"
else
  rojo "patches/ecorpus: alguno no aplica sobre $ref (skill upstream-patches, Paso 3)"
  echo "$out" | grep -E '^(OK|ERROR)' | indent
fi

# --- 2. Voyager: puntero del submódulo y parches ---
v_old=$(git rev-parse "HEAD:source/voyager")
v_new=$(git rev-parse "$ref:source/voyager")
if [ "$v_old" = "$v_new" ]; then
  verde "Voyager sin cambios ($(echo "$v_old" | cut -c1-8))"
else
  amarillo "Voyager cambia $(echo "$v_old" | cut -c1-8) -> $(echo "$v_new" | cut -c1-8): revisar parches y overlays de Voyager"
  if git -C source/voyager cat-file -e "$v_new^{commit}" 2>/dev/null \
     || { [ -n "$fetch" ] && git -C source/voyager fetch -q origin "$v_new" 2>/dev/null; }; then
    echo "           $(git -C source/voyager rev-list --count "$v_old..$v_new") commits en Voyager"
    mkdir "$tmp/voyager"
    git -C source/voyager archive "$v_new" | tar -x -C "$tmp/voyager"
    if out=$(sh scripts/apply-patches.sh --check voyager "$tmp/voyager" 2>&1); then
      verde "patches/voyager aplican sobre el Voyager nuevo"
    else
      rojo "patches/voyager: alguno no aplica sobre el Voyager nuevo (skill upstream-patches, Paso 3)"
      echo "$out" | grep -E '^(OK|ERROR)' | indent
    fi
    changed=$(git -C source/voyager diff --name-only "$v_old" "$v_new" -- \
      assets/fonts/fonts.css assets/language/string.resources.en.json assets/language/string.resources.fr.json \
      assets/language/string.resources.es.json)
    [ -z "$changed" ] || { amarillo "Voyager cambió archivos que copian nuestros overlays (branding/fonts, branding/language):"; echo "$changed" | indent; }
  else
    amarillo "no se pudo obtener el commit nuevo de Voyager: probar los parches tras 'git submodule update'"
  fi
fi

# --- 3. Archivos que copian o sobreescriben nuestros overlays de eCorpus ---
changed=$(git diff --name-only "$base" "$ref" -- \
  source/ui/styles/theme.scss source/ui/styles/buttons.scss \
  source/server/templates/locales/en.yml source/server/templates/partials/head.hbs)
if [ -z "$changed" ]; then
  verde "sin cambios en theme.scss, buttons.scss, en.yml ni head.hbs"
else
  amarillo "cambios que pueden pedir actualizar branding/css/theme.css o es.yml (docs/customization.md):"
  echo "$changed" | indent
fi

# --- 4. Migraciones nuevas ---
changed=$(git diff --name-only --diff-filter=A "$base" "$ref" -- source/server/migrations)
if [ -z "$changed" ]; then
  verde "sin migraciones nuevas"
else
  amarillo "migraciones nuevas (respaldo de la base antes de desplegar):"
  echo "$changed" | indent
fi

# --- 5. Archivos propios en source/ que upstream también toca ---
ours=$(git diff --name-only --diff-filter=A "$base" HEAD -- source)
clash=""
for f in $ours; do
  if git cat-file -e "$ref:$f" 2>/dev/null; then clash="$clash$f
"; fi
done
if [ -z "$clash" ]; then
  verde "upstream no agrega archivos que ya agregamos nosotros"
else
  rojo "upstream agrega archivos que también agregamos (conflicto en el merge):"
  printf %s "$clash" | indent
fi

# --- 6. source/ commiteado con parches dentro ---
if out=$(sh scripts/apply-patches.sh --check --strict ecorpus 2>&1); then
  verde "source/ en HEAD sin parches aplicados"
else
  rojo "source/ en el árbol actual tiene parches aplicados o no aplican (scripts/apply-patches.sh --revert ecorpus)"
fi

echo
if [ $red = 1 ]; then echo "Resultado: ROJO"; exit 1
elif [ $yellow = 1 ]; then echo "Resultado: AMARILLO"
else echo "Resultado: VERDE"; fi
