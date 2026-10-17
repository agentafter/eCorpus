# Texto que queda en inglés (o en otro idioma) a propósito

Registro de lo que la interfaz en español **no** traduce, para que no se confunda con un olvido.

## Identificadores técnicos (no se traducen)
- Claves YAML/JSON, nombres de variables de interpolación (`{{what}}`, `{{count}}`…), rutas y endpoints.
- Niveles de alcance de los tokens tal como los guarda el servidor (`read`, `write`, `admin` dentro de
  `leads.scopeLadder`): son los valores reales de la API.
- Nombres de producto: eCorpus, Voyager, Voyager-Story, Voyager-Explorer, OAuth, PKCE, DKIM, GLB/glTF, ZIP.
- Claves de `errors` (`"Bad password"`, etc.): el servidor las usa como identificador; solo se traduce el valor.

## Pendiente de upstream (fuera de alcance de la etapa 1)
- **Correo de enlace de acceso** (`templates/emails/connection_{en,fr}.hbs`): `routes/auth/login.ts`
  lo envía siempre en francés, sin mirar el idioma del usuario. Es un comportamiento de upstream; no
  se crea `connection_es.hbs` hasta que upstream elija la plantilla por idioma.
- **Textos de Voyager fijos en el código**: los que no pasan por `string.resources.<lang>.json`
  siguen en inglés. Traducirlos exige parchear el submódulo (AGENTS.md §10). Visibles en el editor:
  títulos de los paneles (`ui/story/MainView.ts`: Navigator, Media, Collection, Task, Explorer,
  Article Editor, Tour Editor, Note Editor), encabezado del panel de tareas ("Tours"), barra del editor
  de artículos (TinyMCE: Save, Close, Paragraph) y "No tours available." (`ui/explorer/TourMenu.ts`).
- **Idioma del visor público** (`templates/scene/explorer.hbs`): sigue el idioma del *contenido* de la
  escena, no el idioma de la interfaz.
- `source/ui/state/strings.ts` (diccionario del cliente, solo fr/en): ningún componente lo importa.
- **Texto fijo en plantillas y rutas del servidor** (no pasa por i18next; también sale en inglés con la
  interfaz en francés). Traducirlo exige editar archivos de upstream; mejor proponerlo a Holusion:
  - `<title>` de las páginas: `title: "Home"`, `"Search"`, `"User Settings"`, `"Administration"`, etc. en
    `routes/views/index.ts` y demás rutas de vistas.
  - `templates/admin/home.hbs`: botón "Send" del correo de prueba.
  - `templates/admin/groups.hbs`: "No group created. Enter a name and click the + to add one".
  - `templates/user/tokens.hbs`: casilla "all" de los alcances (además, `read`/`write`/`admin` son valores de la API).
  - `templates/scene/scene.hbs`: espacio antes de los dos puntos en "Tipo de escena :".
