#!/bin/sh
# Siembra la instancia LOCAL (docker-compose.local.yml) con:
#   - una cuenta admin de prueba con contraseña aleatoria nueva en cada instancia,
#   - unas escenas de ejemplo (cube.glb de los fixtures e2e) para ver tarjetas y listados.
#
# Las credenciales quedan en .local/test-admin.env (ignorado por git) y no se
# imprimen. Solo funciona contra 127.0.0.1 y con la base de usuarios vacía:
# eCorpus acepta sin sesión únicamente el PRIMER usuario (routes/users/index.ts).
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
port=${LOCAL_PORT:-8080}
base="http://127.0.0.1:$port"
state="$root/.local"
creds="$state/test-admin.env"
jar="$state/cookies.txt"
fixture="$root/source/e2e/__test_fixtures/cube.glb"

mkdir -p "$state"

code=$(curl -s -o /dev/null -w '%{http_code}' "$base/" || true)
case "$code" in 2*|3*) ;; *) echo "ERROR: $base no responde ($code). ¿Corriste 'docker compose -f docker-compose.local.yml up -d'?" >&2; exit 1;; esac

if [ ! -f "$creds" ]; then
  user="admin-local"
  pass=$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)
  status=$(curl -s -o "$state/create-user.log" -w '%{http_code}' -X POST "$base/users" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$user\",\"password\":\"$pass\",\"email\":\"admin-local@example.test\",\"level\":\"admin\"}")
  if [ "$status" != "201" ]; then
    echo "ERROR: no se pudo crear la cuenta ($status). ¿La base ya tiene usuarios? Destruye con 'down -v' y repite." >&2
    exit 1
  fi
  umask 077
  printf 'LOCAL_ADMIN_USER="%s"\nLOCAL_ADMIN_PASSWORD="%s"\n' "$user" "$pass" > "$creds"
  echo "Cuenta admin de prueba creada; credenciales en .local/test-admin.env"
fi

. "$creds"
status=$(curl -s -o /dev/null -w '%{http_code}' -c "$jar" -X POST "$base/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$LOCAL_ADMIN_USER\",\"password\":\"$LOCAL_ADMIN_PASSWORD\"}")
[ "$status" = "200" ] || { echo "ERROR: login falló ($status)" >&2; exit 1; }

for n in 1 2 3; do
  name="Escena de prueba $n"
  enc=$(printf '%s' "$name" | sed 's/ /%20/g')
  status=$(curl -s -o /dev/null -w '%{http_code}' -b "$jar" -X POST "$base/scenes/$enc?language=ES" \
    -H 'Content-Type: model/gltf-binary' --data-binary "@$fixture")
  case "$status" in
    2*)  echo "Escena creada: $name" ;;
    409) echo "Ya existe: $name" ;;
    *)   echo "AVISO: no se pudo crear '$name' ($status)" >&2 ;;
  esac
done

echo "Listo: $base"
