---
name: upstream-patches
description: Usar esta skill SIEMPRE que haya que modificar un archivo que viene de upstream (código de eCorpus en source/server, source/ui, o de Voyager en source/voyager), crear, regenerar, revisar o quitar un parche en patches/ecorpus/ o patches/voyager/, o cuando scripts/apply-patches.sh, el CI o el build de Docker fallen porque un parche "no aplica". Dispara con menciones de "parche", "patch", "patches/", "apply-patches", "no aplica", "editar código de upstream", "cambiar una plantilla .hbs de upstream", o cualquier tarea (idioma, CSS, funcionalidad) que solo se resuelva tocando un archivo existente de upstream.
---

# Parches sobre upstream (eCorpus y Voyager)

Decisión del equipo: los cambios al código de upstream **no se proponen a Holusion** (por ahora) y **no se commitean
sobre los archivos de upstream**. Viven como parches en el fork:

| Target | Parches | Se aplican sobre | En git |
|---|---|---|---|
| `ecorpus` | `patches/ecorpus/*.patch` | raíz del repo (`source/server`, `source/ui`…) | `source/` queda igual a `upstream/main` |
| `voyager` | `patches/voyager/*.patch` | `source/voyager` (submódulo) | el submódulo queda en su commit de upstream |

Regla: **modificar un archivo existente de upstream → parche. Archivo nuevo → archivo normal en el fork**
(`templates/locales/es.yml`, `templates/emails/*_es.hbs`, `branding/`…). Así los merges con upstream no chocan en
`source/`, y si upstream cambia las líneas parchadas el parche falla de forma visible (fuzz 0) en vez de perderse.

`scripts/apply-patches.sh [--check|--revert] [--strict] <voyager|ecorpus> [DIR]`:
- sin modo: aplica (salta los que ya están, "YA ESTÁ");
- `--check`: solo verifica que aplican limpio;
- `--revert`: deshace los aplicados (deja `source/` como en git);
- `--strict`: falla si alguno ya estaba aplicado (lo usa el CI: detecta `source/` commiteado con el parche dentro).

Lo aplican el `Dockerfile` (y verifica en el bundle que el cambio llegó) y `.github/workflows/build.yml`.

## Paso 0 — ¿De verdad hace falta un parche?

AGENTS.md §3: antes de parchar, descartar en orden: variable de entorno o `/admin` → overlay en `branding/`
(`ASSETS_DIR`, incluido `branding/language/` para Voyager y `branding/css/theme.css`) → archivo nuevo (plantilla,
ruta, script) que se engancha con una línea → **recién entonces** un parche. Si es solo de estilo, ver skill
`theme-token-override`; si es texto, `es-locale-translation`.

## Paso 1 — Crear un parche nuevo

```bash
git status                                   # limpio
sh scripts/apply-patches.sh ecorpus          # (o voyager) partir con los parches existentes aplicados
# ... editar los archivos de upstream, el mínimo de líneas ...
```

Exportar **solo** los archivos del tema nuevo (si un archivo ya está en otro parche, ver "Dos parches sobre el mismo
archivo"):

```bash
# eCorpus: el diff contra git (= upstream) de los archivos del tema
git diff --no-color -- source/server/ruta/a.ts source/server/templates/b.hbs > /tmp/cuerpo.patch
# Voyager:
git -C source/voyager diff --no-color -- source/client/ui/x.ts > /tmp/cuerpo.patch
```

Armar `patches/<target>/NNNN-tema-corto.patch` = encabezado + cuerpo. NNNN sigue la numeración del target. El
encabezado es texto libre antes del primer `diff --git` (GNU patch lo ignora) y lleva:

```text
Huaka: <qué hace, una línea>.

<Por qué no se pudo hacer con overlay/archivo nuevo. Qué archivos y por qué cada uno.>

Generado sobre <eCorpus upstream|Voyager> <hash completo> (<fecha>).
```

Hash base: eCorpus → `git merge-base upstream/main HEAD`; Voyager → `git -C source/voyager rev-parse HEAD`.

Luego:

```bash
sh scripts/apply-patches.sh --revert ecorpus     # Voyager: git -C source/voyager checkout -- .
git status                                       # source/ sin cambios (eCorpus) / submódulo limpio
sh scripts/apply-patches.sh --check ecorpus      # OK para todos
```

Los `.patch` se guardan en LF (`.gitattributes`: `patches/** eol=lf`); el script prueba también la variante CRLF para
checkouts de Windows. No convertir los finales de línea a mano.

## Paso 2 — Que el build lo demuestre

- Si el parche cambia algo que termina en un bundle (JS/CSS de `dist/`, `server/dist`), agregar en el `Dockerfile` un
  `RUN grep -qF '<marca>' <archivo del bundle> || { echo "ERROR: ..." >&2; exit 1; }` como los existentes: protege
  contra un parche que aplica pero ya no llega al resultado (p. ej., upstream movió el código a otro archivo).
- Plantillas `.hbs` del servidor: la etapa final del `Dockerfile` las copia **desde la etapa build** (ya parchada).
  No volver a copiarlas desde el contexto.
- Build y tests locales con los parches aplicados (Paso 4).

## Paso 3 — Regenerar un parche que no aplica (tras sincronizar con upstream)

El script imprime el `--dry-run` con los hunks rechazados.
1. Leer qué cambió upstream en esas líneas: `git log -p <base>..upstream/main -- <archivo>` (Voyager: lo mismo con
   `git -C source/voyager`). Entender el cambio de upstream **antes** de reaplicar el nuestro.
2. Si upstream ya hace lo que hacía el parche (o lo hizo innecesario), **borrar** el parche y su control en el
   `Dockerfile`, y anotarlo en `docs/customization.md`.
3. Si no: aplicar los demás parches, reaplicar a mano el cambio sobre el código nuevo, exportar como en el Paso 1 y
   actualizar el hash base del encabezado.
4. **Nunca** subir `--fuzz`, ni usar `--forward`/`-N` para ignorar rechazos, ni editar el `.patch` a mano para "que
   entre": un parche que aplica sobre líneas equivocadas es peor que uno que falla.

## Dos parches sobre el mismo archivo

Se aplican en orden alfabético. Si el tema nuevo toca un archivo ya parchado, el parche nuevo se genera **con los
anteriores aplicados**: exportar el diff entre "anteriores aplicados" y "anteriores + cambio nuevo". Forma simple:
copiar el archivo con los anteriores aplicados (`cp a.ts /tmp/a.orig`), editar, y `diff -u` con las rutas
`a/<ruta>` y `b/<ruta>`. Si los dos temas se entrelazan demasiado, juntarlos en un solo parche.

## Paso 4 — Probar en local

```bash
sh scripts/apply-patches.sh ecorpus && sh scripts/apply-patches.sh voyager
npm run build-server && npm run build-ui && npm test
node scripts/check-es-locales.cjs                 # si el parche toca idiomas
sh scripts/apply-patches.sh --revert ecorpus && git -C source/voyager checkout -- .
```

## Paso 5 — Antes de commitear (obligatorio)

```bash
git diff --quiet -- source/server source/ui || echo "source/ parchado: revertir antes de commitear"
git -C source/voyager status --short           # vacío
sh scripts/apply-patches.sh --check ecorpus && sh scripts/apply-patches.sh --check voyager
```

Commitear el `.patch` (y el control del `Dockerfile`, y la documentación) **sin** los archivos de `source/`
modificados. El CI corre `--strict ecorpus` y falla si se coló `source/` parchado.

## Paso 6 — Documentar

Agregar una fila en la tabla de parches de `docs/customization.md` ("Parches sobre upstream"): archivo, qué cambia,
por qué, hash base y el control del `Dockerfile`, si tiene. Si el parche resuelve algo de `docs/pendientes.md`, quitarlo
de ahí en el mismo PR.

## Checklist de salida

- [ ] Se descartó overlay/archivo nuevo antes de parchar.
- [ ] Un parche por tema, mínimo de líneas, con encabezado (qué, por qué y hash base).
- [ ] `--check` en verde para ambos targets.
- [ ] `source/` y el submódulo limpios en el commit.
- [ ] Control en el `Dockerfile` si el cambio llega a un bundle.
- [ ] Build y tests con los parches aplicados en verde.
- [ ] Tabla de `docs/customization.md` actualizada.
