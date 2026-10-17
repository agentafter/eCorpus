---
name: es-locale-translation
description: Usar esta skill SIEMPRE que haya que traducir, agregar, revisar o corregir texto de la interfaz de eCorpus al español — nuevas claves en es.yml, terminología consistente, activar "ES" como idioma de interfaz, o revisar que no haya texto en inglés colado en pantallas de usuario. Dispara con menciones de "traducir", "en español", "es.yml", "idioma de la interfaz", "localización", "i18n", o cuando se agrega cualquier string nuevo visible al usuario en el shell de eCorpus.
---

# Traducción de la interfaz de eCorpus a español

La interfaz (shell) de eCorpus usa i18next con diccionarios YAML en `source/server/templates/locales/`. **El español ya está activado** (rama `feature/i18n-es`): `es.yml` existe y `es` figura en todos los puntos donde upstream fija la lista de idiomas. La tabla de esos puntos, el overlay de Voyager y el procedimiento al sincronizar están en `docs/customization.md` §3 — leerla antes de tocar nada. Cualquier cambio en `es.yml` o en el código **requiere reconstruir la imagen** (skill `ecorpus-docker-build`); el JSON de Voyager en `branding/language/` no (se sube con `put-branding`).

Validación rápida tras cualquier cambio: `node scripts/check-es-locales.cjs` (claves y placeholders de `es.yml` frente a `en.yml`, y claves del overlay de Voyager frente a su `en.json`/`fr.json`). Plurales en `es.yml`: i18next v24 con sufijos `_one`/`_many`/`_other` (el español necesita `_many`), `_zero` opcional.

No confundir con `sceneLanguages` (también en `languages.ts`): ese arreglo **ya incluye "ES"** y controla el idioma del *contenido* de cada escena 3D, no el idioma de la interfaz. No hace falta tocarlo.

## Paso 0 — Antes de traducir nada

Inspeccionar la arquitectura de localización real del commit actual — puede haber cambiado desde que se escribió esta skill:
- ¿siguen siendo `en.yml`/`fr.yml` los únicos locales del shell?
- ¿el selector de idioma valida contra `uiLanguages` en el server, en el cliente, o en ambos?
- Voyager (el visor/editor 3D, submódulo aparte) tiene su **propio** i18n: `source/voyager/assets/language/string.resources.<idioma>.json`, con el texto inglés como clave. Se traduce con el overlay `branding/language/string.resources.es.json`, **sin tocar el submódulo**. Los textos de Voyager escritos directo en el código (sin pasar por `getUILocalizedString`) no se pueden traducir así: anotarlos en `docs/localization/es-untranslated.md`.

No crear un mecanismo de localización paralelo si ya existe uno — usar el existente.

## Paso 1 — Crear `es.yml`

Partir de `en.yml` como base estructural y de `fr.yml` como referencia de tono/estilo de traducción (ambos existen en `templates/locales/`). Traducir clave por clave, sección por sección (`labels`, `buttons`, `fields`, `nav`, `onboarding`, `titles`, `tooltips`, `leads`, `ui`, `info`, `errors` — la lista real de secciones puede variar, listar `en.yml` antes de asumir).

Reglas de traducción, sin excepción:
- Traducir solo texto visible al usuario. **Nunca** traducir claves YAML, nombres de variable, endpoints, nombres de archivo.
- Preservar intacto cualquier placeholder de interpolación (`{name}`, `{count}`, etc.), tags HTML, sintaxis Markdown, atajos de teclado, números y unidades.
  - Ejemplo correcto: `Delete {name}?` → `¿Eliminar {name}?`
  - Ejemplo incorrecto: `Delete {name}?` → `¿Eliminar {nombre}?` (nunca renombrar la variable dentro del placeholder salvo que el motor de i18n lo soporte explícitamente — verificarlo antes).
- Español neutro: técnicamente preciso, apto para patrimonio cultural/museos/arqueología, entendible tanto en LatAm como en España. Evitar regionalismos innecesarios (ej. preferir "computadora" o reformular antes que un término marcadamente local).
- **No tocar `en.yml` ni `fr.yml`**: upstream ya trae `lang.es` en ambos. Mantener el diff mínimo sobre archivos que Holusion sigue actualizando reduce los conflictos futuros.

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

## Paso 3 — Activar el idioma en código (ya hecho)

`es` ya está en los 6 puntos fijos de upstream (tabla en `docs/customization.md` §3): `uiLanguages`, `dicts`, `?lang=` en `routes/index.ts`, selector del pie, asunto del correo de alta y vista previa de correos, más `templates/emails/onboarding_es.hbs`. Esos 6 archivos **no** se editan en git: el cambio vive en `patches/ecorpus/0001-es-ui-language.patch` y cualquier texto nuevo que exija tocar un archivo de upstream va en un parche (skill `upstream-patches`); los archivos nuevos (`es.yml`, `*_es.hbs`) sí son archivos normales. Tras sincronizar con upstream, buscar listas nuevas de idiomas fijas (`grep -rn '"fr"' source/server --include=*.ts --include=*.hbs`) y plantillas de correo nuevas por idioma (`templates/emails/*_fr.hbs` sin su `_es`).

## Paso 4 — Revisar inglés residual

Después de traducir, navegar las pantallas principales (login, dashboard, listado de escenas, admin, diálogos, formularios, estados de error/carga) buscando texto en inglés que haya quedado sin traducir. No es necesario el 100% de las claves el primer día, pero sí las pantallas de uso diario. Si queda algo intencionalmente sin traducir (identificadores técnicos, metadatos), registrarlo en `docs/localization/es-untranslated.md` en vez de dejarlo como un olvido silencioso.

## Paso 5 — Revisar layout con texto en español

El español suele ser más largo que el inglés. Revisar especialmente botones, menús, navegación, diálogos, headings, cards, tablas y tooltips tras traducir. Nunca truncar el texto en español solo para mantener un layout pensado para inglés, salvo que haya una razón de UI genuinamente fuerte (documentarla si se hace).

## Checklist de salida

- [ ] `es.yml` creado, cubre al menos las pantallas de uso diario.
- [ ] Ningún placeholder/interpolación roto.
- [ ] `en.yml`/`fr.yml` no tienen cambios fuera de la línea `lang: es:` agregada.
- [ ] `uiLanguages` incluye `"ES"` en todos los lugares donde está definido (server y, si aplica, cliente), vía `patches/ecorpus/` (`sh scripts/apply-patches.sh --check ecorpus`).
- [ ] Terminología usada es consistente con `docs/localization/es-terminology.md` (y el glosario quedó actualizado si se acuñó un término nuevo).
- [ ] Se revisaron visualmente las pantallas principales en español, en al menos una resolución angosta.
- [ ] Si el visor/editor Voyager tiene textos propios sin traducir, quedó explícitamente anotado que es un trabajo aparte (no se intentó traducir a ciegas dentro del submódulo).
