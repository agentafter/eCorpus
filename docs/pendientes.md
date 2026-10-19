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

## Cambio de nombre y dominio: Qullqa 3D (`qullqa3d.com`)
El nombre pasa a **Qullqa 3D** (`BRAND` en `branding/branding.env` y `deploy/prod/branding.env`, texto de la
vitrina). El logo sigue siendo el de Huaka Digital, la organización detrás del proyecto. Staging conserva su dominio
y el dominio anterior de producción no se redirige (tenía un solo usuario, avisado por correo). Falta, a cargo de la
persona:
- **Cloudflare:** zona `qullqa3d.com`, registros proxied, SSL Full (strict) y un certificado de origen nuevo (el de
  `huaka.digital` no cubre otra zona).
- **CloudPanel:** sitio Reverse Proxy `qullqa3d.com` → `http://127.0.0.1:8000` con ese certificado.
- **`X-Frame-Options: SAMEORIGIN`:** lo agrega `include /etc/nginx/global_settings;` del vhost (staging y producción,
  comprobado) a toda respuesta, y bloquea incrustar escenas y enlaces privados en otros sitios. eCorpus ya maneja el
  encuadre (`DENY` solo en `/auth`, `utils/headers.ts`) y manda sus propios `nosniff`, `Referrer-Policy` y HSTS.
  Arreglo: repetir `add_header Cache-Control no-transform;` dentro de `location @reverse_proxy { … }`; en nginx un
  `add_header` en la location corta la herencia de los del nivel `server`, así que las respuestas de eCorpus dejan
  de llevar los de `global_settings` (sin tocar ese archivo, que es de todos los sitios).
- Si el compose de producción define `HOSTNAME`, pasarlo a `qullqa3d.com` (identidad SMTP y correos de bienvenida).

## Copyright de escenas existentes
Las escenas creadas antes de `patches/ecorpus/0002` dicen "(c) Holusion SAS, all rights reserved". Corregir
cada una en el editor (panel Collection, campo Copyright): en staging, Kero; en producción, revisar el
listado de escenas.

## Vitrina pública
- **Texto de "Sobre el proyecto" en inglés y francés** (`huaka.showcase.heroLead` y `aboutLetter`, en `en.yml` y
  `fr.yml` vía `ecorpus/0005`): son traducción del español validado; falta que alguien los revise.
- **Escenas destacadas y de portada:** etiquetar con `destacada` las que van en "Piezas destacadas" y con `portada`
  las que pueden salir en la portada (hoy ninguna: la portada elige al azar entre todas las públicas).
- Todas las escenas públicas aparecen en "Recién digitalizadas" y en sus colecciones: lo que no deba mostrarse va
  privado, y se comparte con un enlace privado (configuración de la escena → "Enlaces privados").
