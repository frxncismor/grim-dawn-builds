#!/bin/sh
# spec005 T017: genera o comprueba las referencias visuales en la imagen oficial de Playwright para
# Linux, igual que la CI (ubuntu-24.04, Node 22.23.5, ASSET_SOURCE=own, CONTENT_SOURCE=fixture).
# Se ejecuta DENTRO del contenedor y recibe el árbol del repositorio por stdin, ya filtrado por git
# (ver CONTRIBUTING.md, «Visual regression references»); no se monta el repositorio:
#   git ls-files -co --exclude-standard -z | tar --null -T - -cf - | docker run -i --rm … sh /run.sh update
#   update: escribe los PNG en /out;  check: pnpm run e2e:visual con las referencias del repo.
# Frontera real: lo que git ignora (.env*, infra/docker/secrets, node_modules, dist, .git) nunca sale del
# host. Como red de seguridad, el script extrae stdin en /work y aborta si ve un .env, un .env.* (salvo
# .env.example) o infra/docker/secrets; no se usa tar -X ni patrones con comodines.
set -eu
MODE="${1:?uso: visual-baselines-docker.sh update|check}"
NODE_VERSION=22.23.5
# S-001: SHA-256 of node-v22.23.5-linux-x64.tar.gz (nodejs.org SHASUMS256.txt); a mismatch aborts.
NODE_SHA256=c54118104acc524633b5abe106bbf44a53126ec8b4e5fa105cb92b5d7de8a1a1
PNPM_VERSION=12.18.0
mkdir -p /work /opt/node22
# Read stdin first, before any other command can consume it.
# S-001: the tree comes from stdin (git ls-files -co --exclude-standard); nothing is mounted from the host.
tar -C /work -xf -
# Guard: a secret path in the received tree aborts the run (even if git did not ignore it).
if [ -e /work/infra/docker/secrets ] || [ -n "$(find /work \( -name node_modules -o -name .git \) -prune -o   \( -name .env -o \( -name '.env.*' ! -name .env.example \) \) -print)" ]; then
  echo "visual-baselines: el árbol recibido contiene .env, .env.* o infra/docker/secrets; abortado" >&2
  exit 1
fi
if [ ! -x /opt/node22/bin/node ]; then
  NODE_TARBALL="/tmp/node-v${NODE_VERSION}-linux-x64.tar.gz"
  curl -fsSL -o "$NODE_TARBALL" "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.gz"
  echo "${NODE_SHA256}  ${NODE_TARBALL}" | sha256sum -c - || { echo "visual-baselines: SHA-256 de Node no coincide" >&2; rm -f "$NODE_TARBALL"; exit 1; }
  tar -xzf "$NODE_TARBALL" -C /opt/node22 --strip-components=1
  rm -f "$NODE_TARBALL"
fi
export PATH=/opt/node22/bin:$PATH
npm i -g "pnpm@${PNPM_VERSION}" >/dev/null 2>&1
cd /work
export CI=true NG_CLI_ANALYTICS=false ASSET_SOURCE=own CONTENT_SOURCE=fixture INCLUDE_DRAFTS=false
export E2E_PORT=4631 E2E_BASE_URL=http://127.0.0.1:4631
pnpm install --frozen-lockfile
pnpm --filter @gd/domain build
pnpm run build
if [ "$MODE" = update ]; then
  pnpm run e2e:visual:update
  rm -rf /out/* && cp e2e/visual-baselines/*.png /out/
else
  pnpm run e2e:visual
fi
