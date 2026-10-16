---
name: theme-token-override
description: Usar esta skill SIEMPRE que se pida cambiar colores, logo, favicon, tipografía, spacing o cualquier aspecto visual/branding de eCorpus. Dispara con menciones de "branding", "colores", "logo", "favicon", "tipografía", "fuentes", "tema visual", "estilo", "CSS", o pedidos de "que se vea distinto"/"identidad visual". Prioriza siempre el mecanismo sin código (variables de entorno, overlay vía ASSETS_DIR) antes de tocar código fuente, y distingue explícitamente entre el shell de eCorpus y el visor 3D de Voyager, que pueden requerir enfoques distintos.
---

# Branding, colores y tipografía en eCorpus

Antes de escribir una sola línea de CSS: **¿esto se puede lograr sin tocar código?** El 90% de los pedidos de branding (colores, nombre, logo, favicon) se resuelven así.

## Paso 0 — Clasificar el pedido

Hay dos superficies visuales distintas en eCorpus, y el mecanismo correcto depende de cuál se está tocando:

1. **Shell de eCorpus** (login, dashboard, navbar, listados, admin) — renderizado server-side con Handlebars. Confirmado por código: colores/marca vía config, logo/CSS vía overlay de archivos. Ver Paso 1.
2. **Visor/editor 3D (Voyager)**, embebido como componentes Lit con Shadow DOM — un CSS global normalmente **no** penetra el Shadow DOM. Ver Paso 2. Antes de tocar nada acá, leer la skill `voyager-submodule-sync` — puede que ni siquiera haga falta tocar Voyager.

Si el pedido no aclara cuál de las dos superficies, preguntar o inspeccionar dónde vive visualmente lo que se quiere cambiar antes de escribir código.

## Paso 1 — Shell de eCorpus (sin fork, sin rebuild)

### 1a. Nombre, colores, contacto — variables de entorno o `/admin`

**Staging:** el compose de staging lee `branding/branding.env` (`env_file`). El agente edita ese archivo en su `branding/` local, con valores entre comillas dobles (el `#` de un color sin comillas puede leerse como comentario), sin espacios alrededor del `=` y solo con estas claves:
```
BRAND="Nombre del despliegue"
COLOR_PRIMARY="#1D3557"
COLOR_SECONDARY="#99193A"
CONTACT_EMAIL="correo@dominio"
```
Lo sube con `put-branding` y aplica con `ssh huaka-agent staging up`. El archivo se sirve públicamente en `/dist/branding.env`: nunca poner secretos. Las mismas variables **no** deben repetirse en `environment:` del compose (tendrían prioridad).

**Producción:** el compose de producción no lee ese archivo. El agente entrega a la persona, en el paquete de promoción, el bloque exacto para su `environment:`:
```yaml
environment:
  BRAND: "Nombre del despliegue"
  COLOR_PRIMARY: "#hex"
  COLOR_SECONDARY: "#hex"
  CONTACT_EMAIL: "correo@dominio"
```
Si se prefiere poder cambiarlos sin redeploy, **no** definirlas por variable de entorno — configurarlas en cambio desde el panel `/admin` (quedan bloqueadas en la UI si vienen de una env var).

Estos valores se inyectan como variables CSS (`--color-primary`, `--color-secondary`) en `templates/partials/head.hbs` — no hay que tocar ese archivo para que el cambio de color surta efecto.

### 1b. Logo, favicon, CSS adicional — overlay vía `ASSETS_DIR`

`routes/index.ts` monta `express.static(assets_dir)` en `/dist` **antes** de `express.static(dist_dir)`: cualquier archivo dentro de `ASSETS_DIR` con la misma ruta relativa reemplaza al del build por defecto, sin fork.

Trabajar siempre sobre una carpeta **local** `branding/` en la raíz del clon (carpeta nueva del fork; no colisiona con upstream) y commitearla:
```bash
mkdir -p branding/images branding/css
# colocar ahí:
#   images/logo-full.svg
#   images/logo-sm.svg
#   favicon.png
#   favicon.svg
#   css/theme.css      (opcional, override parcial o total)
#   css/corpus.css     (opcional)
```

**Subir a staging** (la llave del agente no tiene shell, `scp` ni `rsync`; este es su único camino de escritura de archivos):
```bash
tar -C branding -czf - . | ssh huaka-agent staging put-branding
```
`put-branding` solo agrega o reemplaza archivos dentro de `branding/` de staging: rechaza symlinks, rutas absolutas o con `..` y subidas de más de 50 MB, y **no borra** nada. Para quitar archivos: `ssh huaka-agent staging clear-branding` (vacía `branding/`) y volver a subir el árbol completo, incluido `branding.env`. Los archivos se sirven sin reiniciar el contenedor.

**Cuidado con la caché:** staging está detrás de Cloudflare, que cachea estáticos (css, svg, png). Antes de concluir que un cambio no funcionó, abrir el recurso con `?v=<timestamp>` o pedir a la persona que purgue la caché / active Development Mode en Cloudflare.

**Producción:** el agente deja `branding/` listo y commiteado; la persona lo sincroniza a `~/ecorpus/branding/` con su propia llave (`rsync -av branding/ USUARIO@SERVIDOR:ecorpus/branding/`) después de validar en staging.

El servidor ya monta esa carpeta (lo configura la persona; el agente no edita el compose):
```yaml
environment:
  ASSETS_DIR: /app/branding
volumes:
  - ./branding:/app/branding
```

**Confirmar los nombres de archivo reales antes de asumir** — pueden cambiar entre versiones de eCorpus. Si hace falta el CSS original como punto de partida, sacarlo del repo o del resultado de un build local (`npm run build-ui`), no del servidor.

### 1c. Tipografía del shell

Preferir sobreescribir **solo** las reglas de `font-family` (vía `@font-face` + overrides puntuales en el `css/corpus.css` del overlay) en vez de reescribir toda la hoja de estilos desde cero — así se sigue heredando el resto del theme cuando Holusion lo actualice.

Fuentes: usar siempre WOFF2 self-hosted, nunca un CDN de fuentes de terceros (razones: reproducibilidad, privacidad, funcionamiento offline, CSP). Antes de agregar cualquier fuente, verificar su licencia (SIL OFL, Apache-2.0 u otra que permita explícitamente embebido web y redistribución) y documentarla:
```text
Fuente:        Versión:        Copyright:
Licencia:      Fuente oficial: Embebido web permitido:
Redistribución permitida:      Atribución requerida:
```
No usar fuentes de licencia desconocida ni bajadas de sitios no oficiales.

## Paso 2 — Visor/editor Voyager (puede requerir código)

Antes de cualquier cambio acá, inspeccionar:
1. ¿el componente Voyager expone CSS custom properties que cruzan el Shadow DOM? (si sí, esas se pueden setear globalmente sin tocar Voyager)
2. ¿expone `::part()`?
3. ¿tiene una API de theming soportada?
4. ¿el componente es de eCorpus o de Voyager? (afecta si el cambio va en el repo principal o en el submódulo)

Orden de preferencia si hace falta estilizar: custom properties → `::part` → estilos a nivel de wrapper component → parche mínimo sobre Voyager (último recurso — y en ese caso, activar la skill `voyager-submodule-sync` para el procedimiento correcto de parcheo del submódulo). Nunca asumir que el CSS del overlay (`ASSETS_DIR`) llega al interior del visor sin haberlo verificado en pantalla.

Evitar `!important` salvo necesidad real comprobada; si se usa, dejar un comentario explicando por qué.

## Paso 3 — Tokens de diseño

Centralizar todo en variables semánticas, no descriptivas de apariencia:
```css
:root {
  --color-primary: ...; --color-secondary: ...; --color-accent: ...;
  --color-background: ...; --color-surface: ...;
  --color-text: ...; --color-text-muted: ...; --color-border: ...;
  --color-success: ...; --color-warning: ...; --color-error: ...; --color-info: ...;
  --color-focus: ...;
  --radius-sm: ...; --radius-md: ...; --radius-lg: ...;
  --font-display: ...; --font-heading: ...; --font-body: ...; --font-ui: ...; --font-mono: ...;
}
```
Evitar nombres como `--blue-button` o `--dark-grey-panel` — los nombres semánticos sobreviven un rediseño futuro sin tocar el árbol de componentes.

## Paso 4 — Accesibilidad (no opcional)

Al tocar cualquier color: revisar contraste de texto normal, texto secundario, links, botones, errores, warnings, éxito y foco de teclado. Nunca comunicar un estado únicamente por color. Revisar visibilidad del foco y navegación por teclado tras cualquier cambio de theme.

## Checklist de salida

- [ ] Se evaluó primero el mecanismo sin código (env var / `ASSETS_DIR`) antes de tocar cualquier archivo fuente.
- [ ] Se distinguió explícitamente shell de eCorpus vs. visor Voyager, y se usó el mecanismo correcto para cada uno.
- [ ] Branding subido a staging con `put-branding` y verificado sin caché (`?v=<timestamp>`).
- [ ] Toda fuente nueva tiene licencia verificada y documentada.
- [ ] Tokens de diseño son semánticos, no descriptivos de apariencia.
- [ ] Contraste y foco de teclado revisados tras el cambio.
- [ ] Probado en desktop y en una ventana angosta.
- [ ] Si se tocó código de Voyager: se siguió el procedimiento de la skill `voyager-submodule-sync`.
