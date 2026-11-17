#!/bin/sh
# spec005 T017: genera o comprueba las referencias visuales en la imagen oficial de Playwright para
# Linux, igual que la CI (ubuntu-24.04, Node 22.23.5, ASSET_SOURCE=own, CONTENT_SOURCE=fixture).
# Se ejecuta DENTRO del contenedor (ver CONTRIBUTING.md, «Visual regression references»):
#   sh visual-baselines-docker.sh update   # escribe los PNG en /out
#   sh visual-baselines-docker.sh check    # pnpm run e2e:visual con las referencias del repo
# Trabaja sobre una copia de /src sin node_modules, dist ni .angular: nada del host entra.
set -eu
MODE="${1:?uso: visual-baselines-docker.sh update|check}"
NODE_VERSION=22.23.5
PNPM_VERSION=12.18.0
mkdir -p /work /opt/node22
if [ ! -x /opt/node22/bin/node ]; then
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.gz" | tar -xz -C /opt/node22 --strip-components=1
fi
export PATH=/opt/node22/bin:$PATH
npm i -g "pnpm@${PNPM_VERSION}" >/dev/null 2>&1
tar -C /src --exclude=./node_modules --exclude='*/node_modules' --exclude=./dist --exclude=./.angular \
  --exclude='*/.angular' --exclude=./.git --exclude=./test-results --exclude=./playwright-report -cf - . | tar -C /work -xf -
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
