---
name: upstream-sync
description: Usar esta skill SIEMPRE que haya que traer cambios de Holusion/eCorpus (upstream) al fork agentafter/eCorpus, evaluar si conviene sincronizar, o revisar qué rompería una actualización. Dispara con menciones de "actualizar eCorpus", "sincronizar con upstream", "traer cambios de Holusion", "merge upstream", "nueva versión de eCorpus", "upstream-report", o cuando se quiera saber si hay novedades upstream. Encadena voyager-submodule-sync, upstream-patches, es-locale-translation y ecorpus-docker-build.
---

# Sincronizar el fork con upstream (eCorpus + Voyager)

Modelo del fork (ver skill `upstream-patches`): `source/` en git es **igual a upstream**; nuestros cambios a archivos
de upstream viven en `patches/ecorpus/` y `patches/voyager/`; lo propio es archivo nuevo (`branding/`, `es.yml`,
`*_es.hbs`, docs, scripts). Por eso un merge de upstream casi nunca choca en `source/`: el trabajo real está en que los
**parches sigan aplicando** y los **overlays sigan cubriendo** lo que upstream cambió.

No se le propone nada a Holusion (decisión del equipo): todo se resuelve con parches propios.

## Cadencia

Sincronizar cada 1–3 meses, o antes si upstream publica un arreglo de seguridad. Entre medio, el informe (Paso 1)
sirve para saber cuánto trabajo se viene sin tocar nada.

## Paso 1 — Informe (solo lectura)

```bash
sh scripts/upstream-report.sh            # hace git fetch upstream; --no-fetch para no hacerlo
```

Revisa: commits nuevos; `patches/ecorpus` sobre el código de `upstream/main` (copia temporal); puntero de Voyager y
`patches/voyager` sobre el Voyager nuevo; cambios en lo que copian nuestros overlays (`theme.scss`, `buttons.scss`,
`en.yml`, `head.hbs`, `fonts.css` y diccionarios de Voyager); migraciones nuevas; archivos que agregamos y upstream
también agrega; `source/` del árbol actual con parches commiteados.

- **VERDE**: sincronizar es mecánico.
- **AMARILLO**: hay trabajo de overlay/traducción o un Voyager nuevo; anotarlo para los pasos 4–5.
- **ROJO**: un parche no aplica o hay choque de archivos. Mostrarle el informe a la persona antes de seguir y estimar
  el trabajo (Paso 3 de `upstream-patches` por cada parche en rojo).

## Paso 2 — Rama y merge (nunca rebase)

`main` está compartida: un rebase obligaría a `push --force`, que está prohibido (AGENTS.md §12). Siempre merge en una
rama propia:

```bash
git status                                  # limpio; si no, parar
git switch main && git pull --ff-only origin main
git switch -c sync/upstream-$(date +%F)
git merge --no-ff upstream/main -m "chore: merge upstream eCorpus $(git rev-parse --short upstream/main)"
git submodule update --init --recursive     # skill voyager-submodule-sync
```

`git merge` pide confirmación (`settings.json`). Si hay conflictos:
- En `source/` **no debería haberlos** (no commiteamos cambios ahí). Si aparece uno, alguien commiteó `source/`
  modificado: resolver a favor de upstream y llevar nuestro cambio a un parche (`upstream-patches`).
- En archivos compartidos con personalización (`Dockerfile`, `.github/workflows/*`, `.gitignore`, `package.json`):
  AGENTS.md §11, **nunca** "ours"/"theirs" automático. Leer el cambio de upstream, conservarlo y reaplicar solo las
  líneas `Huaka:`. Si no hay confianza en la resolución, parar y pedir revisión.

## Paso 3 — Parches

```bash
sh scripts/apply-patches.sh --check ecorpus
sh scripts/apply-patches.sh --check voyager
```

Regenerar cada uno que falle con la skill `upstream-patches` (Paso 3): entender el cambio de upstream, borrar el
parche si ya no hace falta, reaplicar a mano si sí, actualizar el hash base. Revisar también los controles del
`Dockerfile` (`grep` sobre el bundle): si upstream movió el código, el `grep` debe buscar donde corresponda.

## Paso 4 — Overlays y traducciones

- `theme.scss`/`buttons.scss` cambiaron → `git diff <base>..upstream/main -- source/ui/styles/` y llevar los tokens
  nuevos a `branding/css/theme.css` (skill `theme-token-override`; `docs/customization.md` §1).
- `fonts.css` de Voyager cambió → `branding/fonts/fonts.css`.
- Textos: `node scripts/check-es-locales.cjs` (necesita `npm ci` en `source/server`) y traducir lo nuevo con la skill
  `es-locale-translation`.
- Migraciones nuevas: anotarlas para el paquete de promoción (respaldo de la base antes de desplegar en producción).

## Paso 5 — Build y tests con los parches

```bash
sh scripts/apply-patches.sh ecorpus && sh scripts/apply-patches.sh voyager
npm run build-server && npm run build-ui
(cd source/server && npm test)     # en Windows: correr mocha con las variables de entorno desde Bash (ver abajo)
sh scripts/apply-patches.sh --revert ecorpus && git -C source/voyager checkout -- .
git status                          # solo los cambios del merge y de patches/, branding/, docs/
```

Tests en Windows: `npm test` usa la sintaxis `VAR=1 cmd` (cmd.exe no la entiende) y varios tests de `vfs` crean
archivos con `:` en el nombre, que Windows no admite. Correrlos en Linux, en contenedores desechables (desde Bash, con
los parches ya aplicados; la base por defecto de los tests es el puerto 3211, por eso `PGPORT`):

```bash
docker network create ecorpus-test
docker run -d --rm --name ecorpus-test-pg --network ecorpus-test -e POSTGRES_PASSWORD=postgres \
  --tmpfs /var/lib/postgresql:rw postgres:18
MSYS_NO_PATHCONV=1 docker run --rm --network ecorpus-test -v "$PWD/source/server:/src:ro" \
  -e PGHOST=ecorpus-test-pg -e PGPORT=5432 -e PGUSER=postgres -e PGPASSWORD=postgres -e PGDATABASE=postgres \
  node:22 sh -c 'mkdir /w && cd /src && tar --exclude=./node_modules --exclude=./dist -cf - . | tar -xf - -C /w \
    && cd /w && npm ci --no-fund --no-audit >/dev/null && npm test 2>&1 | tail -40'
docker stop ecorpus-test-pg && docker network rm ecorpus-test
```

Referencia: 1517 tests en verde (2026-10-17, upstream `d5fca779` + `patches/ecorpus/0001`).

Los e2e (`source/e2e`, Playwright) los corre el CI sobre el paquete armado; correrlos local solo si el merge tocó
flujos de UI.

## Paso 6 — Imagen, staging y PR

1. PR de `sync/upstream-AAAA-MM-DD` a `main` (push pide confirmación). El CI de la PR corre `--strict ecorpus`,
   tests y build.
2. Tras el merge, `publish.yml` publica `ghcr.io/agentafter/e-corpus:sha-<commit>`.
3. Skill `ecorpus-docker-build`: `staging pull` → `staging up` → `staging health` → `staging logs 100`.
4. Skill `staging-visual-check` en ES y EN.
5. Paquete de promoción para la persona (tag, líneas del compose, migraciones, rollback). Producción la aplica ella.

## Paso 7 — Registrar

En `docs/customization.md`, "Registro de sincronizaciones": fecha, hash de `upstream/main`, hash de Voyager, parches
regenerados o eliminados, y cualquier sorpresa útil para la próxima vez.

## Checklist de salida

- [ ] Informe revisado; los ROJO, explicados a la persona antes de seguir.
- [ ] Merge en una rama `sync/…` (sin rebase ni push forzado), submódulo actualizado.
- [ ] `--check` en verde para ambos targets; controles del `Dockerfile` vigentes.
- [ ] Overlays (`theme.css`, `fonts.css`) y `check-es-locales.cjs` al día.
- [ ] Build y tests con parches en verde; `source/` limpio en el commit.
- [ ] Staging validado (`staging-visual-check`); paquete de promoción entregado.
- [ ] Sincronización registrada en `docs/customization.md`.
