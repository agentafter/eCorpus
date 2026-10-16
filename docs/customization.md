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

## 2. Visor/editor Voyager — parche de colores (requiere build propio)

Voyager fija sus colores en Sass compilado dentro del Shadow DOM (sin custom properties ni `::part`), así que no hay punto de extensión desde eCorpus. El submódulo `source/voyager` **queda intacto en git**; el cambio vive en el fork como parche:

- `patches/voyager/0001-huaka-colors.patch` — solo `source/client/ui/explorer/styles.scss` (lo importa también el editor). Generado sobre Voyager `f7a70e6fe13502410dfa0da50d87b43f91d7d9f7` (2026-10-16).
- `scripts/apply-voyager-patches.sh` — aplica con `--fuzz=0`; **falla** si el parche no aplica limpio, salta si ya está aplicado; `--check` solo verifica.
- Se ejecuta en el `Dockerfile` (antes de `build-ui`, con una verificación posterior de que `#99193a` está en `voyager-explorer.js`) y en `.github/workflows/build.yml` (job UI). Si una actualización de Voyager rompe el parche, **el build/CI falla**: el parche no se pierde en silencio.

Mapeo: selección/activo `#99193A` · fondos de paneles navy (`#1D3557` y derivados) · foco `#97BDC6` · links de anotaciones `#C2E9F3`.

- `patches/voyager/0002-huaka-default-colors.patch` — colores por defecto en TypeScript (no Sass): anotaciones **nuevas** y plano de corte en teal `#97BDC6` = `[0.5922, 0.7412, 0.7765]` (antes azul SI `[0, 0.61, 0.87]`; 4 decimales porque Voyager trunca al pasar a hex y con 3 sale `#96bcc5`).
  - El `Dockerfile` verifica que ese valor llegue a `voyager-story.js`.
  - `voyager-*.js` se sirven sin parámetro de versión: tras desplegar una imagen nueva, purgar la caché de Cloudflare o los navegadores pueden seguir usando el bundle viejo.
  - `source/client/models/Annotation.ts`: solo el valor inicial de una anotación nueva. **No** se toca `Annotation.defaultColor` ni la comparación de `toJSON`: Voyager omite el color al guardar cuando es el azul SI y lo rellena con `defaultColor` al cargar; cambiarlos recolorearía las anotaciones existentes. Así, las anotaciones viejas siguen azules y las nuevas se guardan con el teal explícito (se ven teal incluso en un Voyager sin parche).
  - `source/client/components/CVSlicer.ts`: preset y valor de respaldo del color del corte. Las escenas que ya guardaron un color de corte lo conservan.
- `patches/voyager/0003-huaka-white-logo.patch` — `source/client/ui/Logo.ts`: la marca del visor pide `images/logo-{full,sm}-white.svg` en vez de `logo-{full,sm}.svg`. eCorpus usa esa misma ruta para la barra (clara) y Voyager la pinta sobre el visor (oscuro); con un solo archivo, uno de los dos queda sin contraste. Si falta el archivo blanco, `<object>` muestra el logo por defecto de Voyager. El `Dockerfile` verifica que `logo-full-white.svg` llegue a `voyager-explorer.js`.
No cubierto: `story/editor_css/content.min.css` (CSS interno del editor de artículos TinyMCE, links `#0089bf`).

### Regenerar el parche tras actualizar Voyager

```bash
sh scripts/apply-voyager-patches.sh --check        # ¿sigue aplicando?
# si falla:
cd source/voyager
# reaplicar a mano los cambios del .patch viejo sobre source/client/ui/explorer/styles.scss
git diff --no-color source/client/ui/explorer/styles.scss > ../../patches/voyager/0001-huaka-colors.patch
git checkout -- source/client/ui/explorer/styles.scss   # dejar el submódulo limpio
cd ../.. && sh scripts/apply-voyager-patches.sh --check
```
Actualizar aquí el hash de Voyager sobre el que se generó.

Build local: `sh scripts/apply-voyager-patches.sh && npm run build-ui` deja el submódulo modificado; revertir con `git -C source/voyager checkout -- .` antes de commitear.

## 3. Licencias en la imagen publicada

La imagen `ghcr.io/agentafter/e-corpus` redistribuye eCorpus y Voyager, así que lleva los textos de licencia (Apache-2.0 §4) en `/app/licenses/`: `NOTICE.md` (procedencia, ver §1.5 de AGENTS.md), la licencia de eCorpus, `LICENSE.md`/`3RD_PARTY_LICENSES.txt`/`ATTRIBUTIONS.md` de Voyager y las licencias MIT de sus bibliotecas `ff-*`. Los copia el `Dockerfile`; si falta alguno, el build falla.

`publish.yml` fija la etiqueta `org.opencontainers.image.licenses=Apache-2.0`: sin ella `metadata-action` la deja vacía (el repo no tiene `LICENSE` en la raíz, igual que upstream) y pisa la del `Dockerfile`.
