# Imágenes de marca

| Archivo | Reemplaza | Dónde se ve |
|---|---|---|
| `images/logo-full.svg` | Logo de eCorpus (Holusion) | Barra superior (fondo claro) |
| `images/logo-sm.svg` | Logo corto de eCorpus | Barra superior en pantallas < 576px |
| `images/logo-full-white.svg`, `logo-sm-white.svg` | Logo de eCorpus en el visor | Marca del visor Voyager, esquina superior derecha (fondo oscuro). Requiere el parche `patches/voyager/0003-huaka-white-logo.patch` |
| `favicon.svg`, `favicon.png` | Favicon de eCorpus | Pestaña del navegador |

**Titular:** Huaka Digital. Son su logotipo e isotipo: marca propia, **no** licenciada bajo Apache-2.0 como el código de este repositorio (Apache-2.0 §6 no otorga derechos de marca, ni sobre las de Holusion ni sobre esta). Se publican aquí solo para servir este despliegue.

**Origen:** SVG originales en `branding-src/huaka/` (color, blanco y negro). Los de esta carpeta son copias con el `viewBox` recortado al dibujo (`150 154 1731 629` el logotipo; `255 234 1080 1080`, cuadrado, el isotipo); los trazados no se tocan. `favicon.svg` es el isotipo a color. `favicon.png` (64 px) es un raster del mismo isotipo, para navegadores sin favicon SVG.

La atribución de procedencia del software ("Powered by eCorpus under the Apache 2.0 license" en el pie, y `NOTICE.md`) se mantiene: el logo es identidad del despliegue, no atribución.
