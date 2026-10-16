---
name: es-locale-translation
description: Usar esta skill SIEMPRE que haya que traducir, agregar, revisar o corregir texto de la interfaz de eCorpus al español — nuevas claves en es.yml, terminología consistente, activar "ES" como idioma de interfaz, o revisar que no haya texto en inglés colado en pantallas de usuario. Dispara con menciones de "traducir", "en español", "es.yml", "idioma de la interfaz", "localización", "i18n", o cuando se agrega cualquier string nuevo visible al usuario en el shell de eCorpus.
---

# Traducción de la interfaz de eCorpus a español

La interfaz (shell) de eCorpus usa i18next con diccionarios YAML en `source/server/templates/locales/`. Hoy solo existen `en.yml` y `fr.yml`. `uiLanguages` está hardcodeado en `source/server/utils/languages.ts` como `["EN", "FR"]` — agregar español **requiere tocar código y reconstruir la imagen** (no es una variable de entorno). Ver skill `ecorpus-docker-build` para el paso de build una vez que la traducción esté lista.

No confundir con `sceneLanguages` (también en `languages.ts`): ese arreglo **ya incluye "ES"** y controla el idioma del *contenido* de cada escena 3D, no el idioma de la interfaz. No hace falta tocarlo.

## Paso 0 — Antes de traducir nada

Inspeccionar la arquitectura de localización real del commit actual — puede haber cambiado desde que se escribió esta skill:
- ¿siguen siendo `en.yml`/`fr.yml` los únicos locales del shell?
- ¿el selector de idioma valida contra `uiLanguages` en el server, en el cliente, o en ambos?
- ¿Voyager (el visor/editor 3D, submódulo aparte) tiene su **propio** sistema de i18n independiente? Si sí, traducir el shell de eCorpus no traduce automáticamente el visor — es un trabajo aparte, posiblemente sobre el submódulo (ver skill `voyager-submodule-sync` antes de tocar nada ahí).

No crear un mecanismo de localización paralelo si ya existe uno — usar el existente.

## Paso 1 — Crear `es.yml`

Partir de `en.yml` como base estructural y de `fr.yml` como referencia de tono/estilo de traducción (ambos existen en `templates/locales/`). Traducir clave por clave, sección por sección (`labels`, `buttons`, `fields`, `nav`, `onboarding`, `titles`, `tooltips`, `leads`, `ui`, `info`, `errors` — la lista real de secciones puede variar, listar `en.yml` antes de asumir).

Reglas de traducción, sin excepción:
- Traducir solo texto visible al usuario. **Nunca** traducir claves YAML, nombres de variable, endpoints, nombres de archivo.
- Preservar intacto cualquier placeholder de interpolación (`{name}`, `{count}`, etc.), tags HTML, sintaxis Markdown, atajos de teclado, números y unidades.
  - Ejemplo correcto: `Delete {name}?` → `¿Eliminar {name}?`
  - Ejemplo incorrecto: `Delete {name}?` → `¿Eliminar {nombre}?` (nunca renombrar la variable dentro del placeholder salvo que el motor de i18n lo soporte explícitamente — verificarlo antes).
- Español neutro: técnicamente preciso, apto para patrimonio cultural/museos/arqueología, entendible tanto en LatAm como en España. Evitar regionalismos innecesarios (ej. preferir "computadora" o reformular antes que un término marcadamente local).
- Agregar la entrada `es: Español` en el bloque `lang:` de `es.yml`, y agregar también `es: Spanish` / `es: Espagnol` (según corresponda) en `en.yml` y `fr.yml` — **esa es la única línea que se debe tocar en esos dos archivos**. No hacer ningún otro cambio ahí: mantener el diff mínimo sobre archivos que Holusion sigue actualizando reduce los conflictos futuros.

## Paso 2 — Glosario de terminología

Mantener (crear si no existe) `docs/localization/es-terminology.md` como fuente de verdad de términos recurrentes, para que la traducción sea consistente entre distintos PRs y distintos agentes:

```markdown
| Inglés | Español | Notas |
|---|---|---|
| Scene | Escena | Escena 3D |
| Annotation | Anotación | Anotación 3D |
| Collection | Colección | Colección de contenido |
| Guided Tour | Visita guiada | Feature orientada al usuario final |
| Viewer | Visor | Visor 3D |
```

Antes de traducir un término nuevo, revisar primero si ya está en el glosario — no reinventar la traducción de algo ya decidido.

## Paso 3 — Activar el idioma en código

En `source/server/utils/languages.ts`:
```ts
export const uiLanguages = ["EN", "FR", "ES"] as const;
```
Revisar si hay otra lista `["EN","FR"]` hardcodeada del lado del cliente/UI (no asumir que el server es el único lugar) — buscar todas las referencias a `uiLanguages` en el repo antes de dar el cambio por completo.

## Paso 4 — Revisar inglés residual

Después de traducir, navegar las pantallas principales (login, dashboard, listado de escenas, admin, diálogos, formularios, estados de error/carga) buscando texto en inglés que haya quedado sin traducir. No es necesario el 100% de las claves el primer día, pero sí las pantallas de uso diario. Si queda algo intencionalmente sin traducir (identificadores técnicos, metadatos), registrarlo en `docs/localization/es-untranslated.md` en vez de dejarlo como un olvido silencioso.

## Paso 5 — Revisar layout con texto en español

El español suele ser más largo que el inglés. Revisar especialmente botones, menús, navegación, diálogos, headings, cards, tablas y tooltips tras traducir. Nunca truncar el texto en español solo para mantener un layout pensado para inglés, salvo que haya una razón de UI genuinamente fuerte (documentarla si se hace).

## Checklist de salida

- [ ] `es.yml` creado, cubre al menos las pantallas de uso diario.
- [ ] Ningún placeholder/interpolación roto.
- [ ] `en.yml`/`fr.yml` no tienen cambios fuera de la línea `lang: es:` agregada.
- [ ] `uiLanguages` incluye `"ES"` en todos los lugares donde está definido (server y, si aplica, cliente).
- [ ] Terminología usada es consistente con `docs/localization/es-terminology.md` (y el glosario quedó actualizado si se acuñó un término nuevo).
- [ ] Se revisaron visualmente las pantallas principales en español, en al menos una resolución angosta.
- [ ] Si el visor/editor Voyager tiene textos propios sin traducir, quedó explícitamente anotado que es un trabajo aparte (no se intentó traducir a ciegas dentro del submódulo).
