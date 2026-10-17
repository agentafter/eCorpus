---
name: staging-visual-check
description: Usar esta skill SIEMPRE que haya que validar visualmente staging (staging-patrimoniovirtual.huaka.digital) tras desplegar una imagen, subir branding, sincronizar con upstream o aplicar un parche de idioma o CSS, y antes de entregar un paquete de promoción a producción. Dispara con menciones de "validar en staging", "revisar staging", "se ve bien", "probar en el navegador", "captura", "móvil", "responsive", o como paso final de ecorpus-docker-build, upstream-sync, theme-token-override y es-locale-translation.
---

# Validación visual de staging

Recorrido de AGENTS.md §13 en el navegador, con Claude in Chrome (cargar antes la skill `claude-in-chrome`). Es el
paso que demuestra que algo funciona: no declarar un cambio visual listo sin él (CLAUDE.md, "Honestidad operativa").

Solo **staging** (`https://staging-patrimoniovirtual.huaka.digital`). Producción se mira solo si la persona lo pide,
y sin iniciar sesión ni cambiar nada.

## Paso 0 — Antes de abrir el navegador

```bash
ssh huaka-agent staging health      # 200
ssh huaka-agent staging logs 100    # sin errores al arrancar
```

**Caché de Cloudflare:** un CSS o SVG recién subido puede servirse viejo. Comprobar el recurso con `?v=<timestamp>`
(por ejemplo `/dist/css/theme.css?v=1729180000`) y compararlo con el archivo local. Si con el parámetro está bien pero
la página carga el viejo, pedirle a la persona que purgue la caché o active Development Mode. No concluir que el
cambio falló sin descartar la caché.

**Credenciales:** si hace falta iniciar sesión, la persona inicia sesión en la pestaña o da un usuario de prueba de
staging. No pedir ni escribir contraseñas en archivos ni en el chat.

## Paso 1 — Recorrido

Una pestaña nueva (`tabs_create_mcp`). En cada pantalla: captura, `read_console_messages` con `pattern: "error|Error"`
y anotar lo raro. Recorrer **en español** (selector del pie o `?lang=es`) y repetir lo esencial **en inglés**
(`?lang=en`) para descartar que el fallo sea de traducción.

| # | Pantalla | Qué mirar |
|---|---|---|
| 1 | Inicio `/ui/` sin sesión | logo, colores, título de la pestaña, pie con "Powered by eCorpus" y selector de idioma |
| 2 | Inicio de sesión | textos, foco visible con Tab, mensaje de error con credenciales malas |
| 3 | Panel / listado de escenas (con sesión) | tarjetas, miniaturas, búsqueda, paginación |
| 4 | Página de una escena `/ui/scenes/<escena>` | pestañas (Resumen, Ver, Editar, Historial…), textos largos en español |
| 5 | Visor `/ui/scenes/<escena>/view` | carga del modelo, colores Huaka, logo blanco sobre el visor, menú, anotaciones, artículos, idioma de la escena |
| 6 | Editor Story `/ui/scenes/<escena>/edit` | paneles y tareas en español, color de anotación nueva |
| 7 | Administración (`/ui/admin`, usuarios) | tablas y formularios |
| 8 | Vista previa de correos `/ui/design/emails` | plantillas `es` |
| 9 | Una página inexistente y un estado de carga | página de error con estilo, sin texto en inglés colado |

## Paso 2 — Tamaños

`resize_window` en **1440×900** (desktop), **820×1180** (tablet) y **390×844** (móvil) para las pantallas 1, 3, 4 y 5.
En móvil, mirar sobre todo los desbordes (las pestañas de la escena son un pendiente conocido, `docs/pendientes.md`),
los botones que se cortan y los tap-targets chicos. El español es más largo: no aceptar un texto truncado como "listo".

## Paso 3 — Accesibilidad rápida

Recorrer con Tab la barra superior y el formulario de inicio de sesión: el foco tiene que verse. Revisar el contraste
de los textos secundarios y de los botones con los colores de marca. Ningún estado debe comunicarse solo con color.

## Paso 4 — Informe

Resumir en el chat: qué se recorrió (pantallas × idioma × tamaño), qué está bien y qué falló, con la URL y la
captura. Lo que no se pudo revisar (por ejemplo, el editor sin sesión) se dice explícitamente. Si sale algo nuevo y
no se arregla ahora, agregarlo a `docs/pendientes.md`. Si el recorrido sirve para una PR o para la persona, ofrecer una
grabación con `gif_creator`.

## Checklist de salida

- [ ] `staging health` 200 y logs sin errores.
- [ ] Caché descartada para los recursos cambiados.
- [ ] Pantallas 1–9 en español; las esenciales también en inglés.
- [ ] Desktop, tablet y 390 px revisados.
- [ ] Consola sin errores nuevos.
- [ ] Informe con lo revisado, lo que falló y lo que quedó sin revisar.
