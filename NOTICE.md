# Aviso de procedencia

Este proyecto está basado en eCorpus de Holusion, licenciado bajo Apache License 2.0
(https://github.com/Holusion/eCorpus).
Incorpora DPO-Voyager de la Smithsonian Institution, licenciado bajo Apache License 2.0
(https://github.com/Smithsonian/dpo-voyager), a través del fork de Holusion.
Otras dependencias y assets de terceros se licencian bajo sus propios términos.

La personalización (tema, tipografía, branding y parches de color sobre Voyager) es de
Huaka Digital. Este despliegue no está mantenido ni respaldado por Holusion ni por la
Smithsonian Institution.

En la imagen Docker, los textos de licencia están en `/app/licenses/`:

- `LICENSE.md`: Apache License 2.0 (eCorpus).
- `voyager/LICENSE.md`, `voyager/3RD_PARTY_LICENSES.txt`, `voyager/ATTRIBUTIONS.md`: DPO-Voyager.
- `voyager/libs/*-LICENSE.md`: bibliotecas ff-* incluidas en Voyager (MIT).
- Las dependencias npm conservan sus licencias en `node_modules/`; las del código del
  navegador están en `dist/js/*.LICENSE.txt`, y las de las fuentes en `dist/fonts/`.
