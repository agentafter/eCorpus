# CLAUDE.md

@AGENTS.md

## Reglas operativas para Claude Code en este repo

Todo lo de arriba (AGENTS.md) aplica. Esto es lo específico de trabajar **en local con acceso SSH al servidor**.

**Skills del proyecto** (`.claude/skills/`): `voyager-submodule-sync`, `es-locale-translation`, `theme-token-override`, `ecorpus-docker-build`. Cárgalas cuando la tarea calce con su descripción, y siempre `voyager-submodule-sync` antes de un build o de sincronizar con upstream.

**Acceso al servidor — solo por `ssh huaka-agent <entorno> <verbo>`:**
- Entornos: `staging` y `prod`. Verbos de lectura (ambos): `ps`, `logs [N]`, `health`, `validate`. Verbos de escritura (solo `staging`): `pull`, `up`, `restart`, `put-branding`, `clear-branding`. `ssh huaka-agent help` los lista.
- **`prod` es de solo lectura para ti.** Si un cambio debe llegar a producción, prepara el cambio exacto (imagen/tag validado en staging, líneas del compose, archivos de branding) y entrégaselo a la persona para que lo aplique ella; no busques otro camino.
- Nunca uses otro host, otro usuario ni `root`. Si un comando SSH es rechazado, es a propósito: no intentes rodearlo (otras formas de invocarlo, `scp`, `rsync`, comandos encadenados); informa el rechazo.
- Para subir branding a staging: `tar -C branding -czf - . | ssh huaka-agent staging put-branding` (en Windows, desde la herramienta Bash, nunca desde PowerShell: corrompe los datos binarios del pipe).
- Para quitar archivos de branding en staging: `ssh huaka-agent staging clear-branding` (vacía `branding/`) y luego vuelve a subir el árbol completo con `put-branding`.
- Nombre, colores y contacto de staging (`BRAND`, `COLOR_PRIMARY`, `COLOR_SECONDARY`, `CONTACT_EMAIL`, y nada más) se cambian con el archivo `branding/branding.env` (formato `CLAVE="valor"` con comillas dobles, una por línea, sin secretos: se sirve públicamente en `/dist/branding.env`); súbelo con `put-branding` y luego `staging up`. El compose de staging, el `.env` y la imagen los cambia solo la persona.
- `docker compose config` sin `--quiet` imprime contraseñas interpoladas: no lo uses; para validar usa `staging validate`.

**Secretos:** no leas ni imprimas `.env`, claves SSH ni tokens. No los copies a archivos del repo.

**Staging está detrás de Cloudflare:** un CSS/SVG recién subido puede verse viejo por caché. Verifícalo con un parámetro (`?v=<timestamp>`) o pide a la persona purgar caché / activar Development Mode antes de concluir que el cambio no funcionó.

**Honestidad operativa:** si falta un acceso, un permiso o una herramienta, dilo; no simules un paso ni afirmes que algo funcionó sin haberlo comprobado (por ejemplo, con `staging health` y `staging logs 100`).
