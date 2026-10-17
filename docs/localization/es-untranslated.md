# Texto que queda en inglés (o en otro idioma) a propósito

Registro de lo que la interfaz en español **no** traduce, para que no se confunda con un olvido. Lo que se
quiere resolver más adelante está resumido en `docs/pendientes.md`.

## Identificadores técnicos (no se traducen)
- Claves YAML/JSON, nombres de variables de interpolación (`{{what}}`, `{{count}}`…), rutas y endpoints.
- Niveles de alcance de los tokens tal como los guarda el servidor (`read`, `write`, `admin` dentro de
  `leads.scopeLadder`): son los valores reales de la API.
- Nombres de producto: eCorpus, Voyager, Voyager-Story, Voyager-Explorer, OAuth, PKCE, DKIM, GLB/glTF, ZIP.
- Claves de `errors` (`"Bad password"`, etc.): el servidor las usa como identificador; solo se traduce el valor.

## Pendiente de parche (fuera de alcance de la etapa 1)
Se resuelve con parches propios en `patches/ecorpus/` o `patches/voyager/` (skill `upstream-patches`); no se
proponen a Holusion.
- **Textos de Voyager fijos en el código**: los que no pasan por `string.resources.<lang>.json`
  siguen en inglés. Traducirlos exige parchear el submódulo (AGENTS.md §10). Ya resueltos con
  `patches/voyager/0004`: títulos de los paneles del editor y "No tours available.". Quedan: encabezado
  del panel de tareas ("Tours") y barra del editor de artículos (TinyMCE: Save, Close, Paragraph).
- **Idioma del visor público** (`templates/scene/explorer.hbs`): sigue el idioma del *contenido* de la
  escena, no el idioma de la interfaz.
- `source/ui/state/strings.ts` (diccionario del cliente, solo fr/en): ningún componente lo importa.
- **Texto fijo en plantillas y rutas del servidor**: resuelto con `patches/ecorpus/0003` (títulos de
  pestaña vía el helper `pageTitle`, "Send", "No group created", "all", "-- select an option --",
  "request in progress", "Tipo de escena :" y la página de error) y `0004` (correo de enlace de acceso
  según el idioma). Los valores `read`/`write`/`admin` de los alcances de tokens siguen en inglés: son
  valores de la API.
