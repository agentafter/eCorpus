# Plan potencial (no está en desarrollo)

Ideas evaluadas y con un diseño preliminar, **sin aprobar ni planificar en detalle**. Antes de desarrollar
cualquiera, pasarla a un plan concreto (modo plan) y responder sus preguntas abiertas. Criterio común de todo:
AGENTS.md §3, personalizar sin divergir de upstream (eCorpus y Voyager).

Registrado el 2026-10-17, con eCorpus en `aef2fb63` y Voyager en `f7a70e6f`.

---

## 1. Metadatos y paradatos personalizados, visibles al visitante

**Objetivo:** fichas tipo Omeka (por ejemplo, Dublin Core) para cada escena, más paradatos de la
digitalización, editables por el equipo y visibles para el público.

### Lo que ya existe (verificado en el código)
- Cada escena es un `scene.svx.json` de Voyager; su bloque `meta` (`source/voyager/source/client/schema/meta.ts`)
  trae dos diccionarios libres:
  - `collection`: registro de catálogo (Smithsonian guarda ahí su ficha). Ya contiene `titles`, `intros` y
    copyright, y acepta cualquier clave → **metadatos**.
  - `process`: información de procesamiento → **paradatos** (técnica, equipo, software, operador, fecha…).
- Ambos se guardan en el historial de la escena, viajan en el ZIP exportado y upstream no los toca.
- Faltan:
  - El panel "Collection" del editor Story (`ui/story/CollectionPanel.ts`) edita claves existentes de
    `collection`, pero no permite crear campos, solo texto plano y sin idiomas. `process` no tiene interfaz.
  - El visor público (Explorer) no muestra `collection` ni `process`.
  - La página de escena de eCorpus (`templates/scene/scene.hbs`) solo muestra idioma, conteos, introducción,
    copyright y tipo.
  - La búsqueda (`migrations/002-search.sql`, `006-updateSearch.sql`) indexa solo títulos e introducciones.

### Diseño propuesto (de menor a mayor divergencia)
1. **Datos en `meta.collection` / `meta.process` del svx.** No requiere código de upstream ni base de datos.
   **No** crear tablas propias: las migraciones de eCorpus van numeradas (`009-auth.sql`…) y una nuestra
   chocaría con la siguiente de Holusion.
2. **Esquema de campos como configuración:** por ejemplo, `branding/metadata-schema.json`, con la lista de
   campos, sus etiquetas ES/EN, tipo, si son multilingües y si son públicos.
3. **Visibilidad para el visitante:**
   - Página de escena de eCorpus: una plantilla parcial nueva y una línea `{{> fichaMetadatos}}` en `scene.hbs`.
   - Visor 3D **sin parchear Voyager**: generar un **artículo "Ficha técnica"** dentro de la escena con
     esos campos. Los artículos son nativos de Voyager: el visitante lo ve en el menú de artículos y
     respeta el idioma de la escena. Hay que definir si se regenera al guardar la ficha.
4. **Edición:** una pestaña "Metadatos" en la página de la escena de eCorpus, con un formulario generado
   desde el esquema. Lleva una ruta y una plantilla propias, más una línea para montarla en el router.
   Escribe en el svx por la API de archivos existente.
5. **Omeka (opcional):** importar o sincronizar la ficha desde la API de Omeka S por identificador, si
   la catalogación ya vive ahí.

Divergencia esperada: archivos nuevos más 2–3 líneas en archivos de upstream, mantenidas como parche en
`patches/ecorpus/` (skill `upstream-patches`), para que el build falle si una actualización las rompe.

Fuera de la primera versión: búsqueda por campos personalizados (exige cambiar funciones SQL de upstream).

### Preguntas abiertas
1. Esquema: ¿Dublin Core simple (los 15 campos de Omeka), un perfil propio para patrimonio
   arqueológico, o ambos?
2. Paradatos: ¿qué campos? (técnica, equipo, software, fecha, responsable, resolución…)
3. ¿Valores solo en español, o también en inglés como los títulos?
4. ¿Todo público, o algunos campos solo para usuarios con sesión?
5. ¿Existe hoy una instancia de Omeka con estas fichas, o es solo la referencia de formato?

---

## 2. Escenas visibles solo con el enlace (sin listarlas y sin login)

**Objetivo:** compartir una escena con quien tenga el enlace, sin que aparezca en la portada, la búsqueda,
las colecciones ni el sitemap, y sin pedir inicio de sesión.

### Lo que ya existe
- Cada escena tiene `public_access` (`none`/`read`/`write`) y `default_access` (usuarios con sesión).
  "Pública" es `public_access >= read`.
- Con `public_access = read`, la escena aparece en la búsqueda anónima (`vfs/Scenes.ts`: `scenes.public_access > 0`),
  en `/sitemap.xml` (`streamPublicScenes`), en las colecciones y en la API `/scenes`. **No existe** un estado
  intermedio "no listada".

### Opciones
- **A. "No listada" (público, pero oculto en los listados):** la escena es `read` para el público y se
  filtra en la búsqueda, el sitemap, las colecciones y la portada. Sin migración: marcarla con una etiqueta
  reservada (por ejemplo `_no-listar`) o con una clave en `meta.collection`, y filtrar en esas consultas.
  Es simple, pero **no es secreto**: la URL es el nombre de la escena (`/ui/scenes/<nombre>/view`),
  que se puede adivinar.
- **B. Enlace secreto (como "cualquiera con el enlace" de Google Drive):** la escena sigue privada
  (`public_access = none`), y un enlace con token da acceso de solo lectura a esa escena (visor e
  incrustación). eCorpus ya tiene tokens con alcances y enlaces de acceso firmados (`/auth/payload/...`),
  que conviene reutilizar en lugar de crear un mecanismo paralelo. Es más seguro, pero toca la
  autorización de upstream: se haría como parche propio en `patches/ecorpus/`, con revisión de seguridad
  (`/security-review`) antes de desplegarlo.
- Debe poder revocarse (regenerar o borrar el enlace) y dejar claro en la interfaz quién lo ve.

### Preguntas abiertas
1. ¿Basta con "no listada" (A) o hace falta que sea realmente secreta (B)?
2. ¿Debe funcionar también incrustada (iframe) en otro sitio?
3. ¿Los enlaces vencen?

---

## 3. Portada de exhibición para visitantes

**Objetivo:** que la portada muestre lo que hay de forma atractiva (vitrina), en vez de la portada actual,
pensada para el uso interno (mis escenas, primeros pasos, modo independiente).

### Lo que ya existe
- `/` redirige a `/ui/` (`routes/index.ts:94`, en código de upstream). La portada es `templates/home.hbs`.
- `templates_dir` reemplaza el directorio de plantillas **entero**, no sirve como overlay de una sola
  plantilla.
- La API pública `GET /scenes` (con `Accept: application/json`, sin login) ya entrega las escenas públicas
  con miniatura, etiquetas, fechas y autor. Comprobado en producción.

### Opciones
- **A. Vitrina estática en `branding/` (sin fork):** por ejemplo, `branding/vitrina/index.html`, servida en
  `/dist/vitrina/`, que consume `/scenes` y `/tags`: escenas destacadas, colecciones como galerías,
  presentación del proyecto y enlace a la búsqueda. Para que sea la portada, una regla de redirección de
  `/` en Cloudflare o CloudPanel, o un cambio de una línea en la redirección de `routes/index.ts`.
  Cero divergencia en las plantillas de upstream.
- **B. Rediseñar `home.hbs` para visitantes anónimos:** misma app y mismo idioma/i18n, pero edita una
  plantilla que upstream sigue cambiando (conflictos al sincronizar). Habría que mantenerlo como parche.
- Los usuarios con sesión pueden seguir usando la portada actual (`/ui/`) como panel de trabajo.
  Decidido (2026-10-17): la portada actual queda solo para usuarios con cuenta; la pública será la vitrina.
  Al hacerla, corregir también el texto de upstream "Bienvenido a Corpus" (`es.yml`, sale igual en `en.yml`).
- Con el punto 2, la vitrina no debe mostrar escenas "no listadas".
- Con el punto 1, la vitrina puede mostrar campos de la ficha (procedencia, cultura, fechas) en las tarjetas.

### Preguntas abiertas
1. Contenido: ¿escenas destacadas elegidas a mano (etiqueta `destacada`, por ejemplo), colecciones,
   textos institucionales, mapa?
2. ¿Debe seguir el idioma de la interfaz (ES/EN/FR)?
3. ¿Hay referencias visuales (otros museos virtuales, sitio de Huaka Digital)?

---

## Orden sugerido
El punto 2 (enlaces) y el 3 (vitrina) se cruzan en "qué se lista". El 1 (fichas) alimenta al 3 (qué se
muestra en la vitrina). Un orden razonable: **2 → 3 → 1**, o empezar por la vitrina estática (3A), que no
depende de código.
