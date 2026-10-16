# AGENTS.md — Personalización de eCorpus (Huaka Digital)

Este archivo guía a cualquier agente de IA (Claude Code, Cursor, Devin, etc.) que trabaje en este repositorio.

- **Fork**: `github.com/agentafter/eCorpus` (org donde vivirá el fork).
- **Upstream eCorpus**: https://github.com/Holusion/eCorpus — Apache-2.0 — https://ecorpus.eu/en/doc/
- **Upstream Voyager** (submódulo): eCorpus usa `source/voyager` como **submódulo git recursivo**, apuntando al fork de Holusion de DPO-Voyager (`https://github.com/Holusion/dpo-voyager.git`), que a su vez desciende de `https://github.com/Smithsonian/dpo-voyager` — también Apache-2.0, pero con `3RD_PARTY_LICENSES.txt` y `ATTRIBUTIONS.md` propios.
- **Producción**: `patrimoniovirtual.huaka.digital`, servida vía Docker en un servidor Hetzner con CloudPanel (reverse proxy) y Cloudflare delante (proxied, SSL Full-strict).
- **Modo de trabajo del agente**: **en local** (clon del fork, con submódulos) y con acceso al servidor **solo por SSH con una llave restringida** (`huaka-agent`, sección 14.2). Las skills del proyecto están en `.claude/skills/`; las reglas de permisos de Claude Code en `.claude/settings.json`.

**No** es un dato menor que haya dos códigos upstream distintos (eCorpus y Voyager) con licencias separadas: cualquier tarea de branding/tipografía/idioma puede tocar uno, otro, o ambos, y cada uno tiene su propia estrategia de sincronización.

Principio central:

> **Personalizar eCorpus sin generar divergencia innecesaria respecto a upstream — ni en eCorpus ni en el submódulo Voyager.**

---

## 0. Objetivos de esta capa de personalización

1. Identidad visual propia (colores, spacing, componentes).
2. Tipografía personalizada, con fuentes correctamente licenciadas.
3. Traducción de la interfaz al español.
4. Branding (logo, favicon, título, footer) sin ocultar la procedencia del software.
5. Mejoras de accesibilidad y usabilidad donde sea razonable.
6. Una arquitectura de personalización que siga recibiendo actualizaciones de eCorpus **y** de Voyager con el mínimo esfuerzo manual.

---

## 1. Modelo de licencias

### 1.1 eCorpus
Apache-2.0 (declarado en `package.json` y en la documentación). El agente puede modificar TypeScript, JavaScript, Sass/CSS, Handlebars/templates, localización, configuración y branding. Crear un fork está permitido; Apache-2.0 es permisivo y **no** exige copyleft sobre el proyecto derivado completo.

### 1.2 Voyager (submódulo)
También Apache-2.0, pero es un proyecto separado (Smithsonian Institution / fork de Holusion) con su propio `LICENSE.md`, `3RD_PARTY_LICENSES.txt` y `ATTRIBUTIONS.md`. **No asumir** que todas las dependencias o assets dentro de Voyager son Apache-2.0 — Voyager trae dependencias de terceros con licencias propias. Al distribuir un build que incluya Voyager, conservar su atribución y licencias de terceros.

### 1.3 Dependencias de terceros
Ni la licencia de eCorpus ni la de Voyager cambian automáticamente la licencia de sus dependencias. Antes de añadir una dependencia nueva: identificar su licencia, confirmar que permite el uso previsto, revisar requisitos de atribución/redistribución, y documentarla si corresponde.

### 1.4 Reglas de cumplimiento Apache-2.0
- Conservar avisos de copyright y de licencia existentes.
- Conservar información de atribución/`NOTICE`.
- No reclamar como propia la autoría de código upstream.
- No insinuar respaldo oficial de Holusion o de la Smithsonian Institution.
- No eliminar atribución upstream solo para "limpiar" la UI.
- No reemplazar una licencia upstream con un texto que sugiera que todo el código es propietario (ej: nunca poner "Todo el código de este repositorio es propietario" si hay código Apache-2.0 adentro).

### 1.5 Trabajo local propio
El trabajo original local (theme, traducciones, branding) puede licenciarse aparte si el equipo lo decide, pero esa licencia local **no puede** quitar derechos ya otorgados por Apache-2.0 sobre el código upstream, ni presentar el código upstream como enteramente original. Si el proyecto llega a redistribuirse, incluir una sección de atribución que aclare la procedencia:
```text
Este proyecto está basado en eCorpus de Holusion, licenciado bajo Apache License 2.0.
Incorpora DPO-Voyager de la Smithsonian Institution, licenciado bajo Apache License 2.0.
Otras dependencias y assets de terceros se licencian bajo sus propios términos.
```

### 1.6 Branding y marcas
Apache-2.0 no otorga derechos de marca. El agente puede crear una identidad visual nueva, pero no debe insinuar que el despliegue personalizado está oficialmente mantenido o respaldado por Holusion o la Smithsonian. Distinguir siempre "identidad del despliegue local" de "procedencia del software" (ej: mantener un "Powered by eCorpus" o similar en vez de borrarlo).

### 1.7 Licencia de la documentación
No asumir que la documentación de `ecorpus.eu` tiene la misma licencia que el software. No copiar textos de esa documentación dentro de la aplicación o del repo sin verificar su licencia.

### 1.8 Aviso legal
Este documento es una política de ingeniería, no asesoría legal. Antes de cualquier redistribución de producción (sobre todo comercial o a terceros), hacer un inventario final de licencias del commit exacto, submódulos, dependencias y assets efectivamente distribuidos — no asumir que la declaración Apache-2.0 de nivel raíz caracteriza cada archivo o dependencia.

---

## 2. Arquitectura relevante (ya investigada — partir de aquí, no redescubrir desde cero)

```
source/
  server/   → Node/TS. Renderiza el "shell" de eCorpus: login, dashboard, admin, listados.
              Usa Handlebars (templates/partials/*.hbs) + config.ts + locales YAML.
  ui/       → Cliente de eCorpus (probablemente Lit también, para paneles/listados).
  voyager/  → SUBMÓDULO GIT. El visor/editor 3D. Componentes Lit con Shadow DOM.
```

Puntos ya confirmados por inspección directa del código (`source/server/utils/config.ts`, `routes/index.ts`):

- `config.ts` central: `brand`, `color_primary`, `color_secondary`, `contact_email`, `assets_dir`, `templates_dir` — configurables por variable de entorno o, si son `runtime_values`, también desde `/admin` (quedan bloqueadas en la UI si vienen de env var).
- `utils/languages.ts`: `uiLanguages = ["EN", "FR"]` (hardcodeado, requiere fork/build para agregar `"ES"`). `sceneLanguages` ya incluye `"ES"` — el contenido de las escenas ya soporta español, es independiente de la UI.
- `templates/locales/{en,fr}.yml`: diccionarios i18next de la interfaz del shell. No existe `es.yml`.
- `routes/index.ts`: monta `express.static(assets_dir)` en `/dist` **antes** de `express.static(dist_dir)` → cualquier archivo en `ASSETS_DIR` con la misma ruta relativa (`images/logo-full.svg`, `css/theme.css`, `favicon.png`, etc.) reemplaza al del build por defecto, **sin fork ni rebuild**. Esto cubre el shell de eCorpus (login, navbar, dashboard).

**Importante — esto lo cubre el shell de eCorpus, no necesariamente el visor/editor 3D de Voyager**: Voyager es un conjunto de Web Components Lit con Shadow DOM. Un CSS global servido vía `ASSETS_DIR` **no necesariamente penetra** el Shadow DOM de los componentes Voyager (`voyager-explorer`, `voyager-story`, etc.). Antes de asumir que el mismo mecanismo de `ASSETS_DIR` sirve para re-tematizar el visor/editor 3D, hay que **inspeccionar** si Voyager expone variables CSS custom properties que sí cruzan el límite del Shadow DOM, o `::part()`, o una API de theming soportada — ver sección 5.

---

## 3. Principio de personalización "upstream-safe"

Para cada cambio, preguntar:

> ¿Esta personalización puede sobrevivir una futura actualización de eCorpus o de Voyager con mínima intervención manual?

**Preferir, en este orden:**
1. Variable de entorno / configuración en runtime (cero código).
2. Archivo servido vía `ASSETS_DIR` (overlay, cero fork).
3. Archivos de theme locales nuevos, custom properties CSS, variables Sass.
4. Recursos de localización (nuevos archivos, no ediciones de los existentes salvo lo imprescindible).
5. Puntos de extensión existentes del componente (wrapper components, `::part`, props de theming).
6. Parches aislados y pequeños sobre código existente.

**Evitar:**
- Duplicar componentes completos de upstream.
- Copiar hojas de estilo completas en vez de sobreescribir tokens puntuales.
- Editar archivos generados/compilados a mano.
- Tocar el submódulo Voyager sin necesidad real.
- Refactors amplios "de paso" mientras se hace una tarea de estilo.
- Hacks de CSS con selectores frágiles o `!important` sin justificar.

---

## 4. Sistema de diseño (tokens semánticos)

Centralizar el theme con variables **semánticas**, no descriptivas de apariencia:

```css
:root {
  --color-primary: ...;
  --color-secondary: ...;
  --color-accent: ...;
  --color-background: ...;
  --color-surface: ...;
  --color-text: ...;
  --color-text-muted: ...;
  --color-border: ...;
  --color-success: ...;
  --color-warning: ...;
  --color-error: ...;
  --color-info: ...;
  --color-focus: ...;

  --radius-sm: ...;
  --radius-md: ...;
  --radius-lg: ...;

  --font-display: ...;
  --font-heading: ...;
  --font-body: ...;
  --font-ui: ...;
  --font-mono: ...;
}
```

Evitar nombres como `--blue-button` o `--dark-grey-panel` — los nombres semánticos son los que sobreviven un rediseño futuro sin tocar el árbol de componentes.

---

## 5. Lit y Shadow DOM (clave para tematizar el visor Voyager)

Antes de estilizar un componente de eCorpus/Voyager, inspeccionar:
1. dónde está definido;
2. si sus estilos están encapsulados (Shadow DOM);
3. si custom properties CSS cruzan esa frontera;
4. si el componente expone `::part()`;
5. si hay una API de theming soportada;
6. si el componente pertenece a eCorpus o a Voyager (afecta qué repo/submódulo tocar).

No asumir que CSS global puede estilizar el interior de un Shadow DOM. Si un componente no se puede estilizar globalmente, evaluar en este orden: custom properties → `::part` → estilos a nivel de componente → wrapper de estilización → parche mínimo sobre upstream (último recurso, y solo sobre Voyager si es realmente necesario — ver sección 10). Evitar `!important`; si se usa, documentar por qué.

---

## 6. Tipografía y licencias de fuentes

Roles semánticos explícitos (Display, Heading, Body, UI, Label, Monospace) en vez de asignar fuentes ad hoc por elemento.

Antes de agregar cualquier fuente, verificar su licencia real. Preferir SIL Open Font License, Apache-2.0 u otra que permita claramente embeberla en web y redistribuirla. **No** agregar fuentes de licencia desconocida, bajadas de sitios no oficiales, o con derechos de embebido/redistribución poco claros.

Documentar cada fuente:
```text
Fuente:        Versión:        Copyright:
Licencia:      Fuente oficial: Embebido web permitido:
Redistribución permitida:      Modificación permitida:
Atribución requerida:          Archivos incluidos:
```

Preferir WOFF2 self-hosted (reproducibilidad, offline, CSP, disponibilidad a largo plazo) sobre CDNs de fuentes de terceros. Estructura sugerida:
```text
source/ui/custom/fonts/<FontName>/
  <FontName>-Regular.woff2
  <FontName>-Bold.woff2
  LICENSE.txt
```

---

## 7. Traducción a español

**No existe** `es.yml` todavía y `uiLanguages` está hardcodeado en `source/server/utils/languages.ts` → esto **requiere fork + build propio**, no se resuelve con variables de entorno (ver sección 14, Docker).

Antes de traducir, inspeccionar la arquitectura de localización existente en vez de crear un mecanismo paralelo: archivos de locale, cargador de traducciones, selector de idioma, comportamiento de fallback, traducciones client-side vs server-side, y **si Voyager tiene su propio sistema de i18n separado** (probable, dado que es un proyecto distinto) — no asumir que traducir el shell de eCorpus traduce automáticamente la UI del visor/editor 3D.

Reglas de traducción:
- Traducir texto visible al usuario, **no** identificadores de programa (nombres de variable, función, clase, CSS, endpoints de API, campos de base de datos, nombres de archivo).
- Preservar placeholders, variables de interpolación, tags HTML, sintaxis Markdown, atajos de teclado, números y unidades. Ej: `Delete {name}?` → `¿Eliminar {name}?` (nunca `{nombre}` salvo que el framework de i18n lo soporte explícitamente).
- Mantener un glosario de terminología en `docs/localization/es-terminology.md` (Scene→Escena, Annotation→Anotación, Viewer→Visor, etc.) como fuente de verdad, para consistencia entre PRs y entre agentes distintos.
- Español neutro: técnicamente preciso, apto para patrimonio cultural/museos/arqueología, entendible tanto en LatAm como en España — evitar regionalismos innecesarios.
- Llevar un registro de texto en inglés que quede intencionalmente sin traducir (identificadores técnicos, metadatos) en `docs/localization/es-untranslated.md` si aplica.

Español suele ser más largo que inglés: revisar botones, menús, diálogos, tablas y tooltips tras traducir — nunca truncar el español solo para mantener el layout pensado para inglés, salvo razón de UI justificada.

---

## 8. Accesibilidad y diseño responsivo

Todo cambio visual debe revisarse en desktop, tablet y ventanas angostas, considerando que el español ocupa más espacio.

Checklist de accesibilidad al tocar colores/tipografía:
- Contraste de texto normal, texto secundario, links, botones, errores, warnings, éxito e indicadores de foco.
- Visibilidad del foco de teclado y navegación por teclado.
- Tamaños de fuente y line-height legibles, tamaños de tap-target adecuados.
- Etiquetas semánticas / para lectores de pantalla.
- Nunca comunicar estado únicamente por color.

---

## 9. Branding

Puede incluir logo, favicon, título de la app, paleta, navegación, login, footer y créditos institucionales. No quitar la atribución legal upstream solo para que el producto "se vea" completamente independiente — distinguir siempre identidad del despliegue local vs. procedencia del software (ver 1.6).

Al agregar íconos u otros assets: verificar origen y licencia, confirmar derechos de redistribución, preservar atribución, documentar el asset. Que un asset sea públicamente visible en la web **no** implica derecho de redistribución.

---

## 10. Política del submódulo Voyager

`source/voyager` debe seguir siendo un submódulo git de verdad. **No**:
- borrarlo;
- "vendorizarlo" (copiarlo como código local) sin razón explícita;
- reescribir su historia git;
- cambiar su repositorio upstream en silencio;
- modificarlo solo para lograr algo de branding que en realidad se puede hacer desde la capa de eCorpus (theme/localización/config).

Antes de tocar Voyager, siempre preguntar: **¿esto se puede lograr desde la capa de UI/theme/localización de eCorpus?** Si sí, hacer eso en vez de tocar el submódulo.

Si de verdad hace falta modificar Voyager: documentar por qué, identificar los archivos exactos, mantener el parche lo más pequeño posible, conservar sus headers de licencia y atribución, evitar refactors no relacionados, registrar el commit de Voyager sobre el que se aplicó, y dejarlo fácil de reaplicar sobre un commit de Voyager más nuevo.

### Sincronización de submódulos
```bash
git submodule update --init --recursive   # al clonar o tras cambiar de rama
git submodule status
git diff --submodule                       # tras actualizar eCorpus, ver si Voyager también cambió
```

---

## 11. Sincronización con upstream (eCorpus + Voyager)

```bash
git remote -v
# origin   = github.com/agentafter/eCorpus  (nuestro fork)
# upstream = https://github.com/Holusion/eCorpus.git  (solo lectura, solo fetch)

git fetch upstream
git status
git diff
git submodule status
```

Nunca sobreescribir personalización local con upstream a ciegas. Ante un conflicto de merge en un archivo que también tiene personalización local: **no** elegir automáticamente "ours" ni "theirs" — inspeccionar el cambio upstream, inspeccionar el cambio local, evaluar si la personalización se puede extraer a un archivo/capa separada, preservar la funcionalidad upstream, reaplicar solo la personalización necesaria, rebuild, test. Si el agente no tiene confianza en la resolución, debe detenerse y pedir revisión humana en vez de forzarla.

---

## 12. Git seguro

- **Nunca** `git push --force` sobre `main`/`master` del fork, y **nunca** ningún push a `upstream` (solo `fetch`, es de solo lectura).
- **Nunca** commitear directo sobre `main`; siempre en una rama de feature, integrada vía PR.
- Antes de cualquier `git push`, correr `git status` / `git diff --stat` y dejar el resumen visible antes de ejecutar.
- **Nunca** commitear secretos: `.env`, contraseñas, claves privadas, certificados TLS, tokens. Verificar `.gitignore` (`.env`, `*.pem`, `*.key`) antes del primer commit. Si un secreto ya quedó commiteado, no basta con borrarlo en un commit nuevo — hay que avisar de inmediato para rotar la credencial; reescribir historial en ese caso requiere intervención humana, no lo resuelve el agente solo.
- Credenciales de alcance mínimo: deploy key/PAT dedicado al fork, nunca credenciales personales ni tokens de administrador de la org.
- Antes de `git rebase upstream/main`: `git status` limpio + rama de respaldo (`git branch backup/pre-rebase-$(date +%F)`). Si el rebase tiene conflictos fuera de lo esperado (ej. algo más que la línea de `uiLanguages`), detenerse y pedir revisión.
- No borrar ramas/tags sin confirmación explícita. No hacer `commit --amend`/rebase sobre historia ya compartida.
- Commits pequeños y de un solo propósito, con prefijo por tipo — reduce drásticamente los conflictos al sincronizar con upstream:
  ```text
  style: add local design tokens
  style: customize navbar
  i18n: add Spanish locale
  i18n: translate scene management
  docs: document font licensing
  docs: document upstream sync strategy
  ```
- Separar siempre "tocar código del fork" de "desplegar en producción" — un merge a `main` del fork **no** dispara automáticamente un despliegue en Hetzner; ese es un paso aparte y explícito.

---

## 13. Build, tests y validación

Los scripts raíz típicos de eCorpus son `npm run build-ui`, `npm run build-server`, `npm test` — **verificar el `package.json` real del fork antes de asumir que siguen siendo esos**, upstream puede haberlos cambiado. Correr también los tests E2E existentes cuando sean relevantes (buscar en `source/e2e/tests/`, revisar si algo asume la lista `["EN","FR"]` de idiomas).

Para cambios visuales sustanciales, validar al menos: login, dashboard/listado de escenas, navegación, visor 3D, editor 3D, anotaciones, administración de usuarios, diálogos/formularios, estados de error y de carga — en el idioma original y en español.

---

## 14. Docker: construir la imagen personalizada

Mientras los cambios sean solo branding vía `ASSETS_DIR`/env vars, **seguir usando la imagen oficial** `ghcr.io/holusion/e-corpus:main` — no hace falta build propio. En cuanto haya cambios de código (español en `uiLanguages`, cualquier ajuste a Voyager), pasar a build propio. Puntos específicos de Docker + submódulos que el agente debe resolver:

- El `Dockerfile`/pipeline de build **debe** clonar (o el checkout de CI debe hacer) `git submodule update --init --recursive` — si el submódulo Voyager no se inicializa, el build falla o produce una imagen sin visor 3D funcional.
- Si el fork usa GitHub Actions para build/publish (el repo original ya trae `.github/workflows/build.yml`/`publish.yml`, revisar si son reusables), el step de checkout debe declarar `submodules: recursive`.
- Build multi-stage recomendado: una etapa Node que corre `build-ui` + `build-server` (con submódulos ya inicializados) y una etapa final liviana que solo copia el resultado — no reinventar esto si el `Dockerfile` upstream ya lo resuelve razonablemente, extenderlo en vez de reescribirlo desde cero.
- Publicar a un registry propio, ej. `ghcr.io/agentafter/e-corpus:latest` (o el nombre que el equipo defina) con un token de alcance `write:packages` únicamente.
- Actualizar `~/ecorpus/docker-compose.yml` en el servidor de producción (**lo hace una persona**, ver 14.2) para apuntar a esa imagen propia **solo cuando ya esté probada en staging**, nunca antes:
  ```yaml
  services:
    app:
      # image: ghcr.io/holusion/e-corpus:main        # mientras solo haya branding vía ASSETS_DIR
      image: ghcr.io/agentafter/e-corpus:latest        # una vez exista la traducción/build propio
      restart: always
      ports:
        - "127.0.0.1:8000:8000"
      depends_on:
        postgres:
          condition: service_healthy
      environment:
        DATABASE_URI: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
        ASSETS_DIR: /app/branding
        BRAND: "Patrimonio Virtual Huaka"
        COLOR_PRIMARY: "#REEMPLAZAR"
        COLOR_SECONDARY: "#REEMPLAZAR"
        CONTACT_EMAIL: "contacto@huaka.digital"
      volumes:
        - app_data:/app/files
        - ./branding:/app/branding
  ```
- Aplicar en el servidor **lo hace una persona**, no el agente (la llave SSH del agente es de solo lectura sobre producción, ver 14.2). Con usuario no-root del grupo docker, nunca root:
  ```bash
  cd ~/ecorpus
  docker compose pull && docker compose up -d
  ```
- Un cambio de imagen (de la oficial a la propia) es un paso de producción, no de desarrollo: el agente lo prepara y lo valida en staging; la persona lo aplica.

---

## 14.1 Entornos: producción vs staging

Existe un entorno de staging en el **mismo servidor Hetzner** que producción, pero completamente aislado a nivel de contenedores, datos y dominio — nunca se comparte carpeta, `.env`, base de datos ni puerto con producción.

| | Producción | Staging |
|---|---|---|
| Dominio | `patrimoniovirtual.huaka.digital` | `staging-patrimoniovirtual.huaka.digital` |
| Carpeta en el servidor | `~/ecorpus/` | `~/ecorpus-staging/` |
| Nombre de proyecto Docker Compose | `eCorpus` | `eCorpus-staging` |
| Puerto interno (`127.0.0.1:PUERTO:8000`) | `8000` | `8001` |
| Base de datos | `ecorpus` | `ecorpus_staging` (credenciales propias) |
| Sitio en CloudPanel | Propio, con certificado de origen de Cloudflare | Propio, con certificado de origen de Cloudflare (hostname de un solo nivel) |

Regla: cualquier imagen nueva construida en la skill `ecorpus-docker-build` se despliega primero en staging (el agente, por SSH — ver 14.2), se valida ahí (login, dashboard, idioma español, visor 3D), y **solo después** de esa validación una persona actualiza `~/ecorpus/docker-compose.yml` de producción. Nunca saltar directo a producción con una imagen que no pasó por staging.

---

## 14.2 Acceso SSH del agente (`huaka-agent`)

El agente trabaja **en local** y llega al servidor con una llave SSH dedicada cuyo `authorized_keys` fuerza el script
`~/bin/agent-gate.sh` (comando forzado + `restrict`). La llave **no obtiene shell**, ni `scp`/`sftp`/`rsync`, ni
port-forwarding: solo un vocabulario cerrado de verbos. Importa porque el mismo servidor aloja otras apps en Docker
(WordPress, n8n, NocoDB…) y un usuario del grupo `docker` equivale a root sobre todas: el límite lo impone el servidor,
no la buena voluntad del agente ni las reglas de permisos locales (que son una ayuda, no una frontera de seguridad).

Sintaxis: `ssh huaka-agent <entorno> <verbo> [arg]`

| Verbo | staging | prod | Qué hace |
|---|---|---|---|
| `ps` | sí | sí | `docker compose ps` del stack |
| `logs [N]` | sí | sí | últimas N líneas (1–2000, por defecto 200) del servicio `app` |
| `health` | sí | sí | código HTTP de `127.0.0.1:<puerto>/` |
| `validate` | sí | sí | `docker compose config --quiet` (valida sin imprimir secretos) |
| `pull` | sí | **no** | `docker compose pull` |
| `up` | sí | **no** | `docker compose up -d` |
| `restart` | sí | **no** | reinicia solo el servicio `app` |
| `put-branding` | sí | **no** | extrae un `.tar.gz` recibido por stdin en `branding/` (sin symlinks ni rutas inseguras, máx. 50 MB, no borra nada) |

Reglas:
- **Producción es de solo lectura para el agente.** Los cambios en producción los aplica una persona con su propio acceso.
- El agente **no edita** el `docker-compose.yml` ni el `.env` del servidor (no existe verbo para eso). Para cambiar la
  imagen, variables (`BRAND`, colores…) o puertos, entrega a la persona el bloque exacto a aplicar y espera confirmación.
- Flujo de promoción: (1) imagen publicada con tag inmutable; (2) el agente corre `staging pull` → `staging up` →
  `staging health` → `staging logs 100`; (3) validación visual en `staging-patrimoniovirtual.huaka.digital`;
  (4) el agente entrega el **paquete de promoción** (tag/hash, líneas exactas del compose, branding, rollback);
  (5) la persona aplica en producción; (6) el agente verifica en solo lectura con `prod health` y `prod logs`.
- Si el gate o una regla de permisos rechaza un comando, es a propósito: informar el rechazo, no rodearlo
  (otras formas de invocar el mismo comando, `scp`, comandos encadenados, otro host u otro usuario).
- Nunca usar `docker compose config` sin `--quiet`: imprime contraseñas interpoladas.
- Skills del proyecto (`.claude/skills/`): `voyager-submodule-sync`, `es-locale-translation`, `theme-token-override`,
  `ecorpus-docker-build`.

---

## 15. Herramientas y permisos que necesita el agente

| Herramienta | Para qué | Alcance recomendado |
|---|---|---|
| `git` + credencial de push al fork | Ramas, commits, PRs, rebase con `upstream`, manejo de submódulo Voyager | Deploy key/PAT solo sobre `agentafter/eCorpus`, nunca sobre `Holusion/eCorpus` |
| Node/npm | `build-ui`, `build-server`, tests | Local al entorno del agente, sin acceso a producción |
| Docker build/push | Construir y publicar la imagen custom (con submódulos inicializados) | Token de registry con scope de solo escritura de paquetes |
| SSH al servidor Hetzner | Operar **staging** (`pull`, `up`, `restart`, `put-branding`) y **leer** producción (`ps`, `logs`, `health`, `validate`) | Llave dedicada `huaka-agent` con comando forzado (`agent-gate.sh`): sin shell, sin `scp`/`rsync`, sin escritura en producción. Ver 14.2 |
| Cloudflare (si hace falta purgar caché tras un cambio de branding) | Verificar que el sitio público refleje los cambios | Preferir que Aaron purgue manualmente desde el dashboard antes que generar un token nuevo solo para esto |

Comandos libres sin pedir confirmación: `git status`, `git diff`, `git log`, `git fetch`, `git submodule status`, builds/tests locales, `docker compose config --quiet`, y los verbos de `ssh huaka-agent staging …` (staging está aislado de producción, es exactamente para eso).
Comandos que requieren confirmación explícita antes de ejecutarse: `git push`, `git rebase`/`merge` sobre `main` y publicar una imagen a un registry. Cualquier escritura en producción queda **fuera** del alcance del agente: la hace una persona.

---

## 16. Procedimiento de cambio (para cada tarea puntual)

1. **Inspeccionar** — localizar la implementación real; no adivinar dónde vive un estilo, una traducción o un componente.
2. **Clasificar** — ¿es código de eCorpus, de Voyager, de un tercero, generado, o ya personalización local?
3. **Elegir el punto de extensión menos invasivo** — theme / CSS custom properties / Sass / config / recursos de localización / wrapper component, antes de tocar código upstream.
4. **Implementar** el cambio más pequeño que logre el resultado pedido.
5. **Validar** — correr los builds/tests relevantes.
6. **Revisar licencias** — si se agregó algo nuevo (fuente, asset, dependencia), verificar su licencia.
7. **Revisar compatibilidad con upstream** — ¿una futura actualización va a pisar o entrar en conflicto con esto?
8. **Documentar** — si el cambio introduce un mecanismo de personalización nuevo, anotarlo en `docs/customization.md`.

---

## 17. El agente DEBE / NO DEBE

**DEBE**: inspeccionar antes de editar · preservar la arquitectura upstream · aislar la personalización local · preservar avisos Apache-2.0 y atribución de Voyager · revisar licencias de terceros antes de sumarlos · documentar fuentes y assets nuevos · preservar placeholders de traducción e identificadores técnicos · usar la arquitectura de localización existente · usar tokens de diseño semánticos · preferir fuentes self-hosted · considerar la expansión de texto en español · considerar accesibilidad · correr builds/tests relevantes · revisar el diff final antes de commitear · mantener cambios pequeños · preservar la relación de submódulo con Voyager.

**NO DEBE**: quitar avisos de licencia o copyright upstream · quitar atribución requerida · atribuirse autoría de código upstream · insinuar respaldo de Holusion o la Smithsonian · modificar Voyager sin necesidad real · reemplazar el submódulo Voyager por una copia sin autorización explícita · agregar fuentes o assets de licencia desconocida · copiar documentación sin revisar su licencia · hardcodear traducciones en TypeScript cuando ya existe un sistema de localización · traducir nombres de variables/identificadores de API · editar bundles generados a mano · agregar dependencias innecesarias para tareas de estilo simples · usar `!important` a ciegas · resolver conflictos de merge eligiendo automáticamente "ours"/"theirs".

---

## 18. Definición de "terminado"

- [ ] El cambio visual/funcional pedido está implementado.
- [ ] La personalización local queda aislada donde es práctico.
- [ ] La funcionalidad upstream de eCorpus sigue intacta.
- [ ] Voyager sigue siendo un submódulo manejable, no vendorizado.
- [ ] Avisos Apache-2.0 y atribución de Voyager preservados.
- [ ] Licencias de fuentes/assets/dependencias nuevas verificadas y documentadas.
- [ ] La localización a español usa la arquitectura existente, con placeholders y terminología consistentes.
- [ ] Layouts responsivos y accesibilidad revisados.
- [ ] Build de UI/servidor exitoso, tests relevantes en verde.
- [ ] El diff de git no contiene cambios sin relación con la tarea.
- [ ] Documentación (`docs/customization.md`, glosario, etc.) actualizada si corresponde.
- [ ] El cambio puede razonablemente sobrevivir una futura actualización de eCorpus/Voyager.
- [ ] Si se tocó código: la imagen Docker propia fue reconstruida, probada en staging, y el `docker-compose.yml` de producción solo lo actualiza una persona tras esa validación — no antes.

---

## 19. Arquitectura objetivo

```
        Holusion/eCorpus (Apache-2.0)         Smithsonian/DPO-Voyager (Apache-2.0)
                    │                                      │
                    │ upstream                             │ upstream (vía submódulo)
                    ▼                                      ▼
        ┌───────────────────────────────────────────────────────────┐
        │                    agentafter/eCorpus (fork)                │
        │   theme · tipografía + licencias · localización ES ·        │
        │   branding · accesibilidad                                  │
        └───────────────────────────────────────────────┬───────────┘
                                                          │ build (con submódulos)
                                                          ▼
                                    ghcr.io/agentafter/e-corpus:latest
                                                          │
                                                          ▼
                              Despliegue en Hetzner (patrimoniovirtual.huaka.digital)
```

El objetivo **no** es un fork congelado para siempre, sino un despliegue distintivo que sigue pudiendo incorporar mejoras de eCorpus y de Voyager con el mínimo conflicto posible.
