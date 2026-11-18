#!/bin/sh
# spec005 T017: genera o comprueba las referencias visuales en la imagen oficial de Playwright para
# Linux, igual que la CI (ubuntu-24.04, Node 22.23.5, ASSET_SOURCE=own, CONTENT_SOURCE=fixture).
# Se ejecuta DENTRO del contenedor (ver CONTRIBUTING.md, «Visual regression references»):
#   sh visual-baselines-docker.sh update   # escribe los PNG en /out
#   sh visual-baselines-docker.sh check    # pnpm run e2e:visual con las referencias del repo
# Trabaja sobre una copia de /src sin node_modules, dist, .angular, .git, .env*, infra/docker/secrets
# ni resultados de pruebas: ningún secreto del host entra en el contenedor.
set -eu
MODE="${1:?uso: visual-baselines-docker.sh update|check}"
NODE_VERSION=22.23.5
# S-001: SHA-256 of node-v22.23.5-linux-x64.tar.gz (nodejs.org SHASUMS256.txt); a mismatch aborts.
NODE_SHA256=c54118104acc524633b5abe106bbf44a53126ec8b4e5fa105cb92b5d7de8a1a1
PNPM_VERSION=12.18.0
mkdir -p /work /opt/node22
if [ ! -x /opt/node22/bin/node ]; then
  NODE_TARBALL="/tmp/node-v${NODE_VERSION}-linux-x64.tar.gz"
  curl -fsSL -o "$NODE_TARBALL" "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.gz"
  echo "${NODE_SHA256}  ${NODE_TARBALL}" | sha256sum -c - || { echo "visual-baselines: SHA-256 de Node no coincide" >&2; rm -f "$NODE_TARBALL"; exit 1; }
  tar -xzf "$NODE_TARBALL" -C /opt/node22 --strip-components=1
  rm -f "$NODE_TARBALL"
fi
export PATH=/opt/node22/bin:$PATH
npm i -g "pnpm@${PNPM_VERSION}" >/dev/null 2>&1
# S-002: .env and .env.* (except the tracked .env.example) at any depth, plus infra/docker/secrets,
# are what .gitignore marks as secret; they never enter the container.
(cd /src && find . \( -name node_modules -o -name .git \) -prune -o \
  \( -name .env -o \( -name '.env.*' ! -name .env.example \) \) -print) >/tmp/secret-excludes
echo ./infra/docker/secrets >>/tmp/secret-excludes
tar -C /src -X /tmp/secret-excludes --exclude=./node_modules --exclude='*/node_modules' --exclude=./dist --exclude=./.angular \
  --exclude='*/.angular' --exclude=./.git --exclude=./test-results --exclude=./playwright-report -cf - . | tar -C /work -xf -
rm -f /tmp/secret-excludes
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
