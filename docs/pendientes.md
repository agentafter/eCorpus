# Pendientes

Trabajo identificado y dejado para más adelante. Al resolver uno, quitarlo de aquí en la misma PR.
Funcionalidades nuevas aún sin aprobar (metadatos, enlaces privados, vitrina): `docs/plan-potencial.md`.

## Interfaz en español: texto que sigue en inglés
Detalle y ubicación exacta de cada texto en `docs/localization/es-untranslated.md` ("Pendiente de parche").
Todo es texto fijo en código de upstream, fuera de i18next o del JSON de Voyager:
- **Shell de eCorpus**: `<title>` de las páginas ("Home", "Search", "User Settings"…), botón "Send" del
  correo de prueba, "No group created…", casilla "all" de los tokens. Camino: parche propio en
  `patches/ecorpus/` que los pase por `i18n` (skill `upstream-patches`).
- **Voyager**: títulos de los paneles del editor Story, encabezado "Tours", barra del editor de artículos
  (TinyMCE) y "No tours available.". Requiere parche sobre el submódulo (`patches/voyager/`, AGENTS.md §10).
- **Correo de enlace de acceso**: upstream lo envía siempre en francés (`routes/auth/login.ts`);
  `connection_es.hbs` ya existe. Camino: parche en `patches/ecorpus/` que elija la plantilla por idioma.

## Diseño móvil: pestañas de la página de escena se cortan
A ~390 px de ancho, la fila de pestañas de `/ui/scenes/<escena>` (`templates/layouts/scene.hbs`:
Resumen, Ver, Editar, Historial, tareas, Configuración) desborda y los textos se cortan. Pasa igual en
inglés: es del diseño de upstream, el español solo lo acentúa. Revisar si se resuelve con CSS en
`branding/css/theme.css` (envolver o desplazar horizontalmente) antes de tocar la plantilla.
Detectado el 2026-10-17 en la rama `feature/i18n-es`.
