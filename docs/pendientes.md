# Pendientes

Trabajo identificado y dejado para más adelante. Al resolver uno, quitarlo de aquí en la misma PR.
Funcionalidades nuevas aún sin aprobar (metadatos, enlaces privados): `docs/plan-potencial.md`.

## Interfaz en español: texto que sigue en inglés
Detalle y ubicación exacta de cada texto en `docs/localization/es-untranslated.md` ("Pendiente de parche").
Lo que queda es texto fijo en código de upstream, fuera de i18next o del JSON de Voyager (camino: parche
propio, skill `upstream-patches`):
- **Voyager**: encabezado "Tours" del panel de tareas y barra del editor de artículos (TinyMCE: Save, Close,
  Paragraph), que necesita el paquete de idioma de TinyMCE.
- **Shell de eCorpus**: títulos de rutas que se agreguen en upstream después de 2026-10-17 (el helper
  `pageTitle` los deja en inglés hasta sumarlos a `huaka.pageTitles` en `es.yml`).

## Copyright de escenas existentes
Las escenas creadas antes de `patches/ecorpus/0002` dicen "(c) Holusion SAS, all rights reserved". Corregir
cada una en el editor (panel Collection, campo Copyright): en staging, Kero; en producción, revisar el
listado de escenas.

## Vitrina pública
- **Texto de "Sobre el proyecto"** (`huaka.showcase.aboutLetter` en `es.yml`, `en.yml` vía `ecorpus/0005`, `fr.yml`):
  es provisional; Huaka Digital debe escribir o validar el definitivo.
- **Escenas destacadas:** etiquetar con `destacada` las que deben encabezar la vitrina (hoy ninguna; la portada usa
  la más reciente).
- Todas las escenas públicas aparecen en "Recién digitalizadas" y en sus colecciones: lo que no deba mostrarse va
  privado hasta que exista el estado "no listada" (`plan-potencial.md` §2).
