---
name: ecorpus-docker-build
description: Usar esta skill SIEMPRE que haya que construir una imagen Docker propia de eCorpus (necesaria en cuanto exista cualquier cambio de código, como la traducción al español), publicarla a un registry, desplegarla en staging por SSH, o preparar la promoción a producción (el cambio en el compose de producción lo aplica una persona). Dispara con menciones de "build", "Dockerfile", "imagen Docker", "publicar imagen", "ghcr", "registry", "desplegar", "docker-compose", o cuando otra skill (es-locale-translation, theme-token-override) termina con un cambio de código que necesita reflejarse en producción.
---

# Build y despliegue de la imagen Docker propia de eCorpus

## Cuándo hace falta build propio (y cuándo NO)

- Branding vía variables de entorno o `ASSETS_DIR` (ver skill `theme-token-override`, pasos 1a/1b) → **no requiere build propio**, seguir usando `ghcr.io/holusion/e-corpus:main`.
- Cualquier cambio de código fuente (traducción a español vía skill `es-locale-translation`, parche sobre Voyager, tipografía que requiera tocar `.hbs`/`.ts`) → **sí requiere build propio**.

No construir una imagen nueva si el cambio en cuestión se puede resolver sin tocar código — ver primero las otras skills.

## Paso 0 — Submódulo inicializado

Antes de cualquier build, confirmar con la skill `voyager-submodule-sync` que el submódulo `source/voyager` está correctamente inicializado. **Un submódulo no inicializado rompe el build o produce una imagen sin visor 3D funcional, y a veces falla recién en tiempo de ejecución, no en build-time** — no asumir que está bien, verificarlo:
```bash
git submodule status   # ningún "-" al inicio de cada línea
```

## Paso 1 — Build local antes de tocar Docker

Verificar los scripts reales en `package.json` (pueden diferir de lo documentado acá):
```bash
npm run build-ui
npm run build-server
npm test
```
No continuar al build de Docker si esto falla localmente.

## Paso 2 — Dockerfile

Revisar si el repo ya trae un `Dockerfile` funcional (lo normal en un fork de eCorpus) — extenderlo en vez de reescribirlo desde cero. Confirmar que el proceso de build de la imagen:
1. clona/copia el repo **con submódulos** (`git submodule update --init --recursive` como parte del contexto de build, o build multi-stage que reciba el checkout ya con submódulos resueltos — el submódulo no se resuelve solo dentro del contenedor);
2. corre `build-ui` y `build-server` dentro de una etapa Node;
3. copia solo el resultado (`dist/`, `node_modules` de producción, etc.) a una etapa final liviana — no arrastrar el árbol de fuentes completo ni herramientas de build a la imagen final.

## Paso 3 — CI (si el fork usa GitHub Actions)

Si `agentafter/eCorpus` reusa los workflows de Holusion (`.github/workflows/build.yml`/`publish.yml`), confirmar que el step de checkout declara submódulos recursivos:
```yaml
- uses: actions/checkout@v4
  with:
    submodules: recursive
```
Sin esto, el CI construye una imagen "vacía" de Voyager sin ningún error visible obvio hasta que alguien abre el visor 3D en producción.

Trabajando en local, si no hay Docker en la máquina del agente, dejar que este CI construya y publique la imagen al hacer push de la rama es más simple que construirla a mano (el push sigue requiriendo confirmación).

## Paso 4 — Publicar

```bash
docker build -t ghcr.io/agentafter/e-corpus:latest .
docker push ghcr.io/agentafter/e-corpus:latest
```
Usar un token con scope `write:packages` únicamente — nunca un token de administrador de la organización. Etiquetar también con un tag inmutable (fecha o hash de commit) además de `latest`, para poder hacer rollback:
```bash
docker tag ghcr.io/agentafter/e-corpus:latest ghcr.io/agentafter/e-corpus:$(git rev-parse --short HEAD)
docker push ghcr.io/agentafter/e-corpus:$(git rev-parse --short HEAD)
```

## Paso 5 — Probar la imagen en staging ANTES de tocar producción

Existe un entorno de staging dedicado en el mismo servidor Hetzner, **completamente separado de producción** (otra carpeta, otro proyecto Docker, otra base de datos):

- Carpeta: `~/ecorpus-staging/` (nunca `~/ecorpus/`, esa es producción).
- Proyecto Docker Compose: `name: eCorpus-staging` (evita colisión de volúmenes/contenedores con el de producción, `eCorpus`).
- Puerto interno: `127.0.0.1:8001:8000` (producción usa `8000`).
- Base de datos propia (`ecorpus_staging`), nunca compartida con producción.
- Dominio: `https://staging.patrimoniovirtual.huaka.digital`, sitio propio en CloudPanel (Reverse Proxy → `http://127.0.0.1:8001`), certificado Let's Encrypt propio.

Flujo (el agente opera por SSH con la llave restringida `huaka-agent`; ver sección 14.2 de AGENTS.md):
```bash
ssh huaka-agent staging pull       # staging usa ghcr.io/agentafter/e-corpus:latest
ssh huaka-agent staging up
ssh huaka-agent staging health     # debe responder "http 200"
ssh huaka-agent staging logs 100   # revisar que arrancó sin errores
```
Si hay que cambiar la línea `image:` (por ejemplo, para probar un tag concreto) o variables de entorno, el agente **no puede** editar el compose del servidor: entrega a la persona el bloque exacto a pegar y espera confirmación.

Validar en `https://staging.patrimoniovirtual.huaka.digital`: login, dashboard, selector de idioma mostrando español, visor 3D cargando una escena de prueba, y cualquier cambio de branding/tipografía relevante a la tarea actual.

**No pasar al Paso 6 (producción) hasta que la validación en staging sea satisfactoria.** Si algo falla en staging, corregir y repetir este paso — es exactamente para eso que existe, y es gratis fallar acá.

## Paso 6 — Producción: la aplica una persona (el agente prepara y verifica)

La llave SSH del agente es de **solo lectura** sobre producción (`prod ps|logs|health|validate`); `pull`, `up`, `restart` y `put-branding` están bloqueados en el servidor. Es deliberado: el mismo host aloja otras apps y producción nunca se despliega como continuación automática de un build.

Cuando staging esté validado, el agente entrega un **paquete de promoción**:
1. Imagen y tag inmutable validados (`ghcr.io/agentafter/e-corpus:<hash>`), con el hash del commit.
2. El cambio exacto del compose de producción (solo las líneas que cambian):
   ```yaml
   services:
     app:
       image: ghcr.io/agentafter/e-corpus:<hash>   # antes: ghcr.io/holusion/e-corpus:main
       # ...resto sin cambios (ASSETS_DIR, BRAND, COLOR_PRIMARY, etc. se mantienen)
   ```
3. Si hay branding: la carpeta `branding/` commiteada y el comando para que la persona la sincronice con su propia llave:
   `rsync -av branding/ USUARIO@SERVIDOR:ecorpus/branding/`
4. El plan de rollback (el tag anterior) y qué verificar después.

La persona lo aplica con su propio acceso (usuario no-root del grupo `docker`, nunca root):
```bash
cd ~/ecorpus
docker compose pull
docker compose up -d
```
`postgres` no se reinicia si su definición no cambió — solo se recrea el contenedor `app`. Fijar `:<hash>` en producción (en vez de `:latest`) hace trivial el rollback.

## Paso 7 — Verificar y tener plan de rollback

Una vez aplicado el cambio, el agente verifica en solo lectura:
```bash
ssh huaka-agent prod health
ssh huaka-agent prod logs 100
```
y se revisa `https://patrimoniovirtual.huaka.digital` en el navegador. Si algo falla, la persona vuelve al tag anterior (`ghcr.io/agentafter/e-corpus:<hash-anterior>` o `ghcr.io/holusion/e-corpus:main`) y repite `docker compose up -d`.

## Checklist de salida

- [ ] Submódulo Voyager confirmado inicializado antes del build.
- [ ] Build y tests locales en verde antes de tocar Docker.
- [ ] Imagen publicada con tag inmutable (hash) además de `latest`.
- [ ] Imagen desplegada y validada en staging (`staging health` = 200, logs sin errores, revisión visual).
- [ ] Paquete de promoción entregado a la persona (tag, líneas del compose, branding, rollback).
- [ ] La persona aplicó el cambio en producción (el agente no lo hizo ni lo intentó).
- [ ] Verificación posterior en solo lectura (`prod health`, `prod logs`) y sitio revisado en el navegador.
