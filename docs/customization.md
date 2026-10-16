# Personalización Huaka de eCorpus

Registro de los mecanismos de personalización locales y de cómo mantenerlos al sincronizar con upstream (eCorpus y Voyager).

## 1. Shell de eCorpus — overlay `ASSETS_DIR` (sin build)

Carpeta `branding/` → montada como `/app/branding` (`ASSETS_DIR`) y servida en `/dist/` **antes** del build (`routes/index.ts`).

| Archivo | Reemplaza | Qué hace |
|---|---|---|
| `branding/css/theme.css` | `/dist/css/theme.css` (compilado de `source/ui/styles/theme.scss`) | Tokens de color/tipografía del tema claro Huaka + `@font-face` Poppins/Inter |
| `branding/fonts/fonts.css` | `/dist/fonts/fonts.css` (`source/voyager/assets/fonts/fonts.css`) | Redirige las familias de Voyager `"Amiri"`→Poppins y `"Hind Siliguri"`→Inter |
| `branding/fonts/*.woff2`, `*-OFL.txt` | — (nuevos) | Fuentes autoalojadas; ver `branding/FONTS.md` |

Variables de entorno del servicio `app` (las aplica una persona en el compose):

```yaml
COLOR_PRIMARY: "#1D3557"
COLOR_SECONDARY: "#99193A"
```

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
