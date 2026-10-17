---
name: voyager-submodule-sync
description: Usar esta skill SIEMPRE que haya que clonar, actualizar, sincronizar con upstream, o simplemente trabajar en cualquier parte del fork de eCorpus (agentafter/eCorpus) que involucre el submódulo Voyager (source/voyager). Dispara con menciones de "submódulo", "voyager", "git submodule", "actualizar eCorpus", "sincronizar con upstream", clonar el repo por primera vez, o cualquier tarea que toque el visor/editor 3D. También úsala antes de cualquier build de Docker del fork, porque un submódulo mal inicializado rompe el build silenciosamente.
---

# Sincronización segura del submódulo Voyager

eCorpus (`agentafter/eCorpus`, fork de `Holusion/eCorpus`) usa `source/voyager` como **submódulo git recursivo**, apuntando al fork de Holusion de DPO-Voyager (que a su vez desciende de `Smithsonian/dpo-voyager`). Es un proyecto separado, con licencia Apache-2.0 propia, `3RD_PARTY_LICENSES.txt` y `ATTRIBUTIONS.md` propios. Un error común y silencioso es clonar u operar el repo sin inicializar el submódulo — el directorio `source/voyager` queda vacío y todo lo que dependa del visor 3D falla más adelante, a veces recién en el build de Docker.

## Cuándo usar esta skill

- Al clonar el fork por primera vez.
- Antes de cualquier `git fetch upstream` / rebase / merge.
- Antes de construir la imagen Docker (ver skill `ecorpus-docker-build`).
- Cuando una tarea de branding, tipografía o traducción pueda tocar el visor/editor 3D (ver skill `theme-token-override`), para confirmar si el cambio requiere tocar Voyager o si se resuelve desde la capa de eCorpus.

## Paso 1 — Clonar o inicializar correctamente

```bash
# clon nuevo
git clone --recurse-submodules git@github.com:agentafter/eCorpus.git

# si el repo ya estaba clonado sin submódulos
git submodule update --init --recursive
```

Verificar que quedó bien:
```bash
git submodule status
# debe mostrar un hash junto a "source/voyager", NO un signo "-" (submódulo no inicializado)
```

## Paso 2 — Configurar remotos (una sola vez por clon local)

```bash
git remote -v
# origin   -> github.com/agentafter/eCorpus (fork, lectura y escritura)
# upstream -> debe existir; si no:
git remote add upstream https://github.com/Holusion/eCorpus.git
git config submodule.recurse true   # para que checkout/pull siempre arrastren el submódulo
```

`upstream` es **solo lectura** (solo `fetch`). Nunca hacer `git push upstream ...`.

## Paso 3 — Antes de sincronizar con upstream

```bash
git fetch upstream
git status                 # debe estar limpio; si no, parar y avisar
git diff                   # revisar si hay cambios locales sin commitear
git submodule status        # ver si Voyager también tiene cambios pendientes
```

No continuar si `git status` no está limpio — hacer commit o stash primero.

## Paso 4 — Actualizar y evaluar impacto

La sincronización completa (informe, merge en una rama `sync/…`, parches, overlays, build, staging) es la skill
`upstream-sync`. **Nunca** `git rebase upstream/main` sobre `main`: está compartida y el push forzado está prohibido.
Tras el merge:

```bash
git submodule update --init --recursive
git diff --submodule        # muestra si el puntero de Voyager cambió y a qué commit
```

Si el puntero de Voyager cambió:
1. Revisar el changelog/commits de Voyager entre el commit viejo y el nuevo (si están disponibles en el repo upstream).
2. `sh scripts/apply-patches.sh --check voyager`; regenerar los que fallen con la skill `upstream-patches`.
3. Correr los builds/tests relevantes (`npm run build-ui`, `npm run build-server`, `npm test`) con los parches aplicados antes de dar la sincronización por terminada.

## Reglas de oro (no negociables)

- **Nunca** borrar el directorio `source/voyager` ni reemplazarlo por una copia local de los archivos ("vendorizar") sin autorización explícita del equipo.
- **Nunca** reescribir la historia git del submódulo.
- **Nunca** cambiar la URL del remoto de Voyager en silencio.
- Antes de modificar cualquier archivo dentro de `source/voyager`, preguntar: *¿esto se puede lograr desde la capa de eCorpus (theme/config/localización) en vez de tocar Voyager?* Si la respuesta es sí, hacer eso en su lugar — ver skill `theme-token-override`.
- Si de verdad hace falta un parche sobre Voyager: va en `patches/voyager/` siguiendo la skill `upstream-patches` (lo más pequeño posible, headers de licencia/atribución intactos, commit base de Voyager en el encabezado).

## Al terminar cualquier sincronización

Dejar registro de la fecha y el hash de `upstream/main` (y del hash de Voyager si cambió) en el README del fork o en `docs/customization.md`, para que el próximo agente sepa desde dónde partir sin tener que reconstruir el historial investigando.

## Checklist de salida

- [ ] `git submodule status` no muestra ningún submódulo con `-` (no inicializado).
- [ ] `git status` limpio tras la sincronización.
- [ ] Si el puntero de Voyager cambió, se evaluó el impacto en personalizaciones locales.
- [ ] Build (`build-ui`/`build-server`) exitoso tras la sincronización.
- [ ] Fecha y hashes de la sincronización documentados.
