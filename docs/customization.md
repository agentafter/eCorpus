# Personalización Huaka de eCorpus

Registro de los mecanismos de personalización locales y de cómo mantenerlos al sincronizar con upstream (eCorpus y Voyager).

## 1. Shell de eCorpus — overlay `ASSETS_DIR` (sin build)

Carpeta `branding/` → montada como `/app/branding` (`ASSETS_DIR`) y servida en `/dist/` **antes** del build (`routes/index.ts`).

| Archivo | Reemplaza | Qué hace |
|---|---|---|
| `branding/css/theme.css` | `/dist/css/theme.css` (compilado de `source/ui/styles/theme.scss`) | Tokens de color/tipografía del tema claro Huaka + `@font-face` Poppins/Inter |
| `branding/fonts/fonts.css` | `/dist/fonts/fonts.css` (`source/voyager/assets/fonts/fonts.css`) | Redirige las familias de Voyager `"Amiri"`→Poppins y `"Hind Siliguri"`→Inter |
| `branding/fonts/*.woff2`, `*-OFL.txt` | — (nuevos) | Fuentes autoalojadas; ver `branding/FONTS.md` |
| `branding/images/logo-full.svg`, `logo-sm.svg` | `/dist/images/logo-*.svg` | Logo Huaka a color en la barra (fondo claro); ver `branding/IMAGES.md` |
| `branding/images/logo-full-white.svg`, `logo-sm-white.svg` | — (nuevos) | Variante blanca para el visor Voyager (fondo oscuro); la pide el parche `0003` |
| `branding/favicon.svg`, `favicon.png` | `/dist/favicon.*` | Favicon Huaka (isotipo) |
| `branding/language/string.resources.es.json` | `/dist/language/string.resources.es.json` (`source/voyager/assets/language/`) | Textos de Voyager en español, completos; ver §3 |

Los SVG salen de los originales de `branding-src/huaka/` cambiando solo el `viewBox` (recorte del margen vacío). Pendiente: los dibujos de fondo (`/dist/images/muse.webp` y `scroll.webp`, de Holusion, Apache-2.0) se reemplazarán igual, con la misma ruta en `branding/images/`.

Nombre, colores y contacto (`BRAND`, `COLOR_PRIMARY`, `COLOR_SECONDARY`, `CONTACT_EMAIL`) los lee el compose de cada entorno con `env_file: ./branding/branding.env`, sin repetirlos en `environment:` (tendría prioridad):

| Entorno | Archivo en el repo | Cómo llega al servidor |
|---|---|---|
| Staging | `branding/branding.env` | `put-branding` (agente) |
| Producción | `deploy/prod/branding.env` | copia a `~/ecorpus/branding/branding.env` (persona, ver abajo) |

Ambos se sirven públicamente en `/dist/branding.env`: solo valores públicos, nunca secretos.

### Producción: sincronizar `branding/`

Lo hace la persona en el servidor, como `agentafter` (no root), descargando del repo público el commit ya validado en staging. No hace falta llave ni copiar desde un PC:

```bash
cd ~/ecorpus
cp -a branding branding.bak-$(date +%F)                    # respaldo para rollback
tmp=$(mktemp -d)
curl -fsSL https://github.com/agentafter/eCorpus/archive/<commit>.tar.gz | tar -xz -C "$tmp" --strip-components=1
cp -a "$tmp/branding/." branding/                          # theme.css, fuentes, FONTS.md
cp "$tmp/deploy/prod/branding.env" branding/branding.env   # después: pisa el de staging
rm -rf "$tmp"
docker compose up -d                                       # solo si cambió branding.env o el compose
```

`cp` no borra archivos que ya no estén en el repo; para quitarlos, borrarlos a mano. Los CSS y fuentes se sirven sin reiniciar; los valores de `branding.env` requieren `up -d`. Después, purgar la caché de Cloudflare.

Requisitos del compose de producción (servicio `app`): `env_file: ./branding/branding.env`, `ASSETS_DIR: /app/branding` y el volumen `./branding:/app/branding:ro`. Verificación:

```bash
docker compose exec app sh -c 'echo "ASSETS_DIR=$ASSETS_DIR"; ls /app/branding'
```
Desde fuera, `/dist/css/theme.css` debe medir lo mismo que `branding/css/theme.css` y `/dist/branding.env` debe responder 200. Si el título y los colores cambian pero `theme.css` no, falta `ASSETS_DIR` o el volumen: `env_file` lo lee Compose en el host, así que funciona aunque la carpeta no esté montada.

`theme.css` **no** define `--color-primary`/`--color-secondary`: vienen de esas variables vía `templates/partials/head.hbs`.

### Al sincronizar con upstream
- `theme.css` reemplaza el archivo entero. Tras cada sync, comparar `git diff <viejo>..<nuevo> -- source/ui/styles/theme.scss` y copiar a `branding/css/theme.css` cualquier token nuevo.
- Lo mismo para `source/voyager/assets/fonts/fonts.css` → `branding/fonts/fonts.css` (familias nuevas) y para `font-family` nuevas en el Sass de Voyager (`grep -rn font-family source/voyager/source/client/ui`).
- Revisar `git diff -- source/ui/styles/buttons.scss`: `theme.css` sobreescribe `--btn-text-color` en `.btn.btn-{main,primary,secondary,danger,success,info}`.
- Correr `node scripts/check-es-locales.cjs` (ver §3).

## 2. Visor/editor Voyager — parche de colores (requiere build propio)

Voyager fija sus colores en Sass compilado dentro del Shadow DOM (sin custom properties ni `::part`), así que no hay punto de extensión desde eCorpus. El submódulo `source/voyager` **queda intacto en git**; el cambio vive en el fork como parche:

- `patches/voyager/0001-huaka-colors.patch` — solo `source/client/ui/explorer/styles.scss` (lo importa también el editor). Generado sobre Voyager `f7a70e6fe13502410dfa0da50d87b43f91d7d9f7` (2026-10-16).
- `scripts/apply-patches.sh voyager` — aplica con `--fuzz=0`; **falla** si el parche no aplica limpio, salta si ya está aplicado; `--check` solo verifica (ver §5).
- Se ejecuta en el `Dockerfile` (antes de `build-ui`, con una verificación posterior de que `#99193a` está en `voyager-explorer.js`) y en `.github/workflows/build.yml` (job UI). Si una actualización de Voyager rompe el parche, **el build/CI falla**: el parche no se pierde en silencio.

Mapeo: selección/activo `#99193A` · fondos de paneles navy (`#1D3557` y derivados) · foco `#97BDC6` · links de anotaciones `#C2E9F3`.

- `patches/voyager/0002-huaka-default-colors.patch` — colores por defecto en TypeScript (no Sass): anotaciones **nuevas** y plano de corte en teal `#97BDC6` = `[0.5922, 0.7412, 0.7765]` (antes azul SI `[0, 0.61, 0.87]`; 4 decimales porque Voyager trunca al pasar a hex y con 3 sale `#96bcc5`).
  - El `Dockerfile` verifica que ese valor llegue a `voyager-story.js`.
  - `voyager-*.js` se sirven sin parámetro de versión: tras desplegar una imagen nueva, purgar la caché de Cloudflare o los navegadores pueden seguir usando el bundle viejo.
  - `source/client/models/Annotation.ts`: solo el valor inicial de una anotación nueva. **No** se toca `Annotation.defaultColor` ni la comparación de `toJSON`: Voyager omite el color al guardar cuando es el azul SI y lo rellena con `defaultColor` al cargar; cambiarlos recolorearía las anotaciones existentes. Así, las anotaciones viejas siguen azules y las nuevas se guardan con el teal explícito (se ven teal incluso en un Voyager sin parche).
  - `source/client/components/CVSlicer.ts`: preset y valor de respaldo del color del corte. Las escenas que ya guardaron un color de corte lo conservan.
- `patches/voyager/0003-huaka-white-logo.patch` — `source/client/ui/Logo.ts`: la marca del visor pide `images/logo-{full,sm}-white.svg` en vez de `logo-{full,sm}.svg`. eCorpus usa esa misma ruta para la barra (clara) y Voyager la pinta sobre el visor (oscuro); con un solo archivo, uno de los dos queda sin contraste. Si falta el archivo blanco, `<object>` muestra el logo por defecto de Voyager. El `Dockerfile` verifica que `logo-full-white.svg` llegue a `voyager-explorer.js`.
No cubierto: `story/editor_css/content.min.css` (CSS interno del editor de artículos TinyMCE, links `#0089bf`).

### Regenerar un parche tras actualizar Voyager

`sh scripts/apply-patches.sh --check voyager`; si alguno falla, regenerarlo con la skill `upstream-patches` (Paso 3) y
actualizar aquí el hash de Voyager sobre el que se generó.

Build local: `sh scripts/apply-patches.sh voyager && npm run build-ui` deja el submódulo modificado; revertir con `git -C source/voyager checkout -- .` antes de commitear.

## 3. Interfaz en español (requiere build propio)

Terminología: `docs/localization/es-terminology.md`. Lo que queda sin traducir a propósito: `docs/localization/es-untranslated.md`.

**Shell de eCorpus** (i18next en el servidor): `source/server/templates/locales/es.yml`, mismas claves que `en.yml` (lo que falte sale en inglés por `fallbackLng`). Plurales con sufijos `_one`/`_many`/`_other` (i18next v24 pide `_many` para el español). La lista de idiomas está fija en varios puntos de upstream, y cada uno lleva `es`. Los archivos de upstream de la tabla **no** se editan en git: el cambio está en `patches/ecorpus/0001-es-ui-language.patch` (ver §5); los `*_es.hbs` y `es.yml` son archivos nuevos del fork:

| Archivo | Qué controla |
|---|---|
| `source/server/utils/languages.ts` (`uiLanguages`) | Opciones de idioma que arma `utils/locals.ts` |
| `source/server/utils/templates/index.ts` (`dicts`) | Diccionarios cargados, `Accept-Language`, `hreflang` del sitemap, idioma del correo de alta y configuraciones de búsqueda (`vfs/Scenes.ts`; `es` usa la configuración `simple` de Postgres) |
| `source/server/routes/index.ts` | `?lang=` aceptado (ahora cualquiera de `dicts`) |
| `source/server/templates/partials/footer.hbs` | Selector de idioma del pie |
| `source/server/routes/users/post.ts` | Asunto del correo de bienvenida |
| `source/server/routes/views/index.ts` | Idiomas de la vista previa `/ui/design/emails` |
| `source/server/templates/emails/onboarding_es.hbs` | Cuerpo del correo de bienvenida (sin él, crear un usuario en español falla) |
| `source/server/templates/emails/connection_es.hbs` | Correo de enlace de acceso; hoy solo lo usa la vista previa (upstream envía siempre `connection_fr`) |

Sin cuenta, el idioma sale de `Accept-Language`; si el navegador no pide es/fr/en, se muestra inglés.

**Voyager** (JSON propio, por idioma): Voyager pide `language/string.resources.<idioma>.json` relativo a `/dist/`, así que el archivo de `branding/language/` lo reemplaza sin tocar el submódulo. Lleva el `es.json` de upstream (70 claves), las 70 claves que solo tienen `en.json`/`fr.json` (textos del editor Story), 13 cadenas que el código de Voyager traduce pero ningún diccionario de upstream incluye (nombres de las tareas de Story: Pose, Capture, Annotations…) y 5 valores de upstream cambiados por consistencia con el glosario ("Tour"/"Recorrido" → "Visita guiada" y "Izquierdo" → "Izquierda"). El editor recibe el idioma de la interfaz (`templates/scene/story.hbs`, `uiLang`); el visor público usa el idioma de la escena, y también lee este archivo cuando la escena está en español.

### Al sincronizar con upstream
`node scripts/check-es-locales.cjs` (tras `npm ci` en `source/server`) falla si `en.yml` tiene claves o placeholders que `es.yml` no tiene, o si el `en.json`/`fr.json` de Voyager, o las cadenas literales que pasa su código a `getUILocalizedString` (y los `text` de sus tareas), traen claves que el overlay no tiene. Traducir lo nuevo, siguiendo el glosario. Si upstream agrega un idioma o cambia alguno de los puntos de la tabla, revisar que `es` siga en cada uno.

## 4. Licencias en la imagen publicada

La imagen `ghcr.io/agentafter/e-corpus` redistribuye eCorpus y Voyager, así que lleva los textos de licencia (Apache-2.0 §4) en `/app/licenses/`: `NOTICE.md` (procedencia, ver §1.5 de AGENTS.md), la licencia de eCorpus, `LICENSE.md`/`3RD_PARTY_LICENSES.txt`/`ATTRIBUTIONS.md` de Voyager y las licencias MIT de sus bibliotecas `ff-*`. Los copia el `Dockerfile`; si falta alguno, el build falla.

`publish.yml` fija la etiqueta `org.opencontainers.image.licenses=Apache-2.0`: sin ella `metadata-action` la deja vacía (el repo no tiene `LICENSE` en la raíz, igual que upstream) y pisa la del `Dockerfile`.

## 5. Parches sobre upstream y sincronización

Regla: en git, `source/` es **igual a upstream** (y el submódulo queda en su commit). Todo cambio a un archivo
existente de upstream vive como parche; lo nuevo (plantillas, locales, `branding/`) es archivo normal del fork. Así un
merge de upstream no choca en `source/`, y si upstream cambia las líneas parchadas el parche falla a la vista (fuzz 0)
en vez de perderse. No se proponen cambios a Holusion (decisión del equipo, 2026-10-17). Procedimiento: skill
`upstream-patches`.

`scripts/apply-patches.sh [--check|--revert] [--strict] <voyager|ecorpus> [DIR]` — `ecorpus` aplica sobre la raíz del
repo y `voyager` sobre `source/voyager`. `--revert` deshace (para no commitear `source/` parchado) y `--strict` falla si un
parche ya estaba aplicado. Se ejecuta en:
- el `Dockerfile`: `ecorpus` antes de `build-server` y `voyager` antes de `build-ui`, con controles `grep` sobre el
  bundle. La etapa final copia `templates/` **desde la etapa build** (ya parchada), no desde el contexto;
- `.github/workflows/build.yml`: `voyager` en el job UI; `--strict ecorpus` en el job Server, antes de los tests (el
  `templates/` parchado que sube ese job es el que usan `pack` y los e2e).

| Parche | Archivos | Qué hace | Control en el `Dockerfile` |
|---|---|---|---|
| `ecorpus/0001-es-ui-language.patch` | los 6 de upstream de §3 | activa `es` en la interfaz | `"ES"` en `server/dist/utils/languages.js` |
| `voyager/0001-huaka-colors.patch` | `explorer/styles.scss` | colores del visor/editor (§2) | `99193a` en `voyager-explorer.js` |
| `voyager/0002-huaka-default-colors.patch` | `Annotation.ts`, `CVSlicer.ts` | color de anotaciones nuevas y corte (§2) | `.5922,.7412,.7765` en `voyager-story.js` |
| `voyager/0003-huaka-white-logo.patch` | `Logo.ts` | logo blanco sobre el visor (§2) | `logo-full-white.svg` en `voyager-explorer.js` |
| `ecorpus/0002-huaka-default-copyright.patch` | `utils/schema/default.ts` | copyright por defecto de escenas nuevas: Huaka Digital | `Huaka Digital, todos los derechos` en `server/dist/utils/schema/default.js` |
| `ecorpus/0003-i18n-shell-strings.patch` | `helpers/index.ts`, `head.hbs`, `design.hbs`, 9 plantillas, `en.yml`, `fr.yml` | títulos de pestaña (helper `pageTitle`) y textos fijos por `i18n` | `pageTitle` en `helpers/index.js` y en `head.hbs` |
| `ecorpus/0004-login-link-language.patch` | `routes/auth/login.ts` | correo de enlace de acceso según el idioma | `acceptsLanguages(dicts` en `server/dist/routes/auth/login.js` |
| `voyager/0004-i18n-story-panels.patch` | `MainView.ts`, `TourMenu.ts`, `ChromeView.ts` | títulos de los paneles del editor y "No tours available." | `translatePanels` en `voyager-story.js` y `noToursText` en `voyager-explorer.js` |
| `voyager/0005-i18n-task-mode.patch` | `TaskBar.ts` | etiqueta del modo del editor ("Edit" → "Edición") | `getUILocalizedString(…ins.mode.getOptionText())` en `voyager-story.js` |
| `ecorpus/0005-showcase.patch` | `routes/views/index.ts`, `navbar.hbs`, `en.yml`, `fr.yml` (sobre 0003) | engancha la vitrina pública: `/ui/` sin sesión y `/ui/vitrina/` | `renderShowcase` en `dist/routes/views/index.js` y `/ui/vitrina/` en `navbar.hbs` |
| `ecorpus/0006-share-links.patch` | `routes/index.ts`, `routes/views/index.ts`, `scene/settings.hbs`, `en.yml`, `fr.yml` (sobre 0003 y 0005) | engancha los enlaces privados a una escena | `shareFilesRouter` en `dist/routes/index.js` y `huakaShareLinks` en `settings.hbs` |

Archivos propios que acompañan a esos parches: `utils/templates/helpers/pageTitle.ts` (+ test),
`routes/auth/loginLinkLanguage.test.ts`, el bloque `huaka:` de `es.yml` (con `huaka.pageTitles`: título en
inglés → español, admite `{{name}}`) y las claves nuevas de `branding/language/string.resources.es.json`.
`scripts/check-es-locales.cjs` lee también las líneas agregadas por `patches/voyager/*.patch`.

`scripts/apply-patches.sh --revert` deshace en orden inverso: `0005` se apoya en las líneas que agrega `0003` en
`en.yml`/`fr.yml`.

### Vitrina pública
Sin sesión, `/ui/` (y por lo tanto `/`) muestra la vitrina; con sesión, `/ui/` sigue siendo el panel de trabajo y la
barra superior suma "Vitrina" (`/ui/vitrina/`). La vitrina lista siempre lo que ve un visitante anónimo (solo escenas
con acceso público de lectura), aunque quien la abra tenga sesión.
- Código propio: `routes/views/showcase.ts` (+ test), `templates/showcase.hbs`, `templates/layouts/showcase.hbs`,
  `branding/css/showcase.css` y `branding/js/showcase.js`. Los dos últimos se sirven desde `branding/`
  (`ASSETS_DIR`): sin la carpeta montada la vitrina sale sin estilos, así que en producción hay que sincronizar
  `branding/` junto con la imagen.
- Textos: `huaka.showcase` en `es.yml`, `en.yml` y `fr.yml`. El mensaje del proyecto (`heroLead` y la carta
  "Sobre el proyecto", `aboutLetter`) habla de metadatos, paradatos y *memory twin*; el español lo validó Huaka
  Digital y el inglés y el francés son su traducción.
- **Destacadas:** las escenas públicas con la etiqueta `destacada` (se agrega en la página de la escena, como
  cualquier etiqueta).
- **Portada:** una pieza al azar entre las que tienen la etiqueta `portada`; si ninguna la tiene, entre todas las
  públicas de la vitrina. "Ver otra pieza" la cambia sin recargar (sin script, recarga con `?pieza=<nombre>`).
  "Ver en 3D" abre el visor ahí mismo; "Ver ficha completa" lleva a la página de la pieza en eCorpus
  (`/ui/scenes/<nombre>/`), donde irán la metadata y la paradata.
- El logo de la barra superior lleva a la vitrina (`/ui/vitrina/`) para todos. Con sesión, la barra suma "Vitrina" y
  "Mi panel" (`/ui/`, el panel de trabajo con "Mis escenas").
- `destacada` y `portada` no aparecen en "Colecciones"; las demás etiquetas sí. "Ver todas las colecciones" lleva a
  `/ui/tags/`.
- Movimiento (`branding/js/showcase.js`, sin librerías): detrás de cada sección hay una pieza distinta que se funde
  con la siguiente al hacer scroll, y las tarjetas aparecen y se desvanecen al entrar y salir de pantalla. Con
  "reducir movimiento" solo se funden.
- Las fotos son las capturas de Voyager de cada escena (`scene-image-low|medium|high.jpg`); sin captura, la
  miniatura. **Las capturas no se generan al subir el modelo:** hay que abrir la escena en el editor → tarea
  **Captura** → botón de captura → **Guardar** (genera la miniatura y las tres capturas). Una pieza sin captura
  aparece en la vitrina con su nombre sobre un fondo azul y no entra en el escenario de fondo. "Ver en 3D" abre el visor de la escena dentro de la portada.
- Diseño trabajado con la skill `design-taste-frontend` (dirección "la página es el objeto": la ficha de inventario
  de cada pieza).

### Enlaces privados (escenas no listadas)
Para compartir una escena sin publicarla: dejarla **privada** (acceso público "ninguno") y crear un enlace en su
página de configuración, sección **Enlaces privados** (solo administradores de la escena).
- El enlace (`/ui/compartido/ecs_…`) abre el visor 3D sin cuenta; con `?embed=1` se incrusta en otro sitio (la página
  de creación da el código del iframe). Al ser privada, la escena no aparece en la vitrina, la búsqueda, las
  colecciones ni el sitemap.
- Se muestra **una sola vez** al crearlo: solo se guarda su hash (como los tokens de la API). Si se pierde, se crea
  otro y se revoca el anterior. No vence: dura hasta que se revoca, y deja de funcionar al instante.
- Varios enlaces por escena, con nombre (uno por destinatario) y fecha de último uso.
- Código propio: `utils/shareLinks.ts` (tabla `huaka_share_links`, creada por ese módulo si no existe, fuera de las
  migraciones numeradas de upstream), `routes/shareLinks.ts`, `partials/huakaShareLinks.hbs`, `share/created.hbs` y
  `routes/shareLinks.test.ts`. Solo lectura (GET), solo los archivos de esa escena, `Cache-Control: private,
  no-store` (Cloudflare no guarda copias tras revocar) y `X-Robots-Tag: noindex`.
- El token viaja en la URL: los registros del proxy (CloudPanel/nginx) y de Cloudflare la guardan. Quien tenga
  acceso a esos registros puede abrir la escena; revocar el enlace lo corta.

### Copyright de las escenas
Las escenas nuevas nacen con "(c) Huaka Digital, todos los derechos reservados" (`ecorpus/0002`). Para poner
la institución correcta: abrir la escena en el editor (Editar) → panel **Collection** → campo **Copyright**
→ Guardar. La página de la escena muestra ese valor. Las escenas creadas antes del parche conservan el texto
de Holusion hasta corregirlas así.

Trabajo local con los parches: aplicar ambos, build y tests, revertir (`--revert ecorpus` y
`git -C source/voyager checkout -- .`). Antes de commitear, `git diff --quiet -- source/server source/ui`.

### Sincronizar con upstream

Skill `upstream-sync`. Primero, el informe de solo lectura `sh scripts/upstream-report.sh` (VERDE/AMARILLO/ROJO): prueba
los parches sobre el código de `upstream/main` y del Voyager nuevo en copias temporales, y avisa de cambios en lo que
copian los overlays, de migraciones nuevas y de choques de archivos. Después, **merge** (nunca rebase) en una rama
`sync/upstream-AAAA-MM-DD`.

### Registro de sincronizaciones

| Fecha | eCorpus upstream | Voyager | Notas |
|---|---|---|---|
| 2026-10-17 | `d5fca779` (2026-10-15) | `f7a70e6f` | Punto de partida del modelo de parches: las ediciones de §3 pasan a `patches/ecorpus/0001`. |
