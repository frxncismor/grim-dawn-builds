# syntax=docker/dockerfile:1
#
# T-054: multi-stage image of the read-only API (@gd/api), plan §12.7 / §12.8 / §12.12.
#
# Build from the REPOSITORY ROOT (pnpm workspace; the context is the monorepo):
#   docker build -f apps/api/Dockerfile -t gd-api .
#
# Pins:
#   - Base: node:22.12.0-slim (same patch as .nvmrc and the CI node-version), pinned by digest.
#     Digest resolved from the registry manifest on 2026-11-09 (docker-content-digest header).
#   - pnpm: 12.18.0 (same as "packageManager" in the root package.json).
#
# Secrets: none. No ARG, no secret ENV, no COPY of .env* or secrets/. Runtime secrets are
# read from files under /run/secrets (plan §13), never baked into a layer.

# ---------------------------------------------------------------------------
# Stage 1: install, build and produce the production tree of @gd/api.
# ---------------------------------------------------------------------------
FROM node:22.12.0-slim@sha256:35531c52ce27b6575d69755c73e65d4468dba93a25644eed56dc12879cae9213 AS build

RUN npm install --global --ignore-scripts pnpm@12.18.0 \
 && npm cache clean --force

WORKDIR /repo

# Manifests first, so the dependency layer is cached until a lockfile or manifest changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/domain/package.json packages/domain/
COPY apps/api/package.json apps/api/

RUN --mount=type=cache,id=gd-api-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store --filter @gd/api...

COPY packages/domain packages/domain
COPY apps/api apps/api

RUN pnpm --filter @gd/api build \
 && pnpm --filter @gd/api deploy --prod /prod/api

# ---------------------------------------------------------------------------
# Stage 2: minimal runtime. Only compiled JS, package.json and prod node_modules.
# ---------------------------------------------------------------------------
FROM node:22.12.0-slim@sha256:35531c52ce27b6575d69755c73e65d4468dba93a25644eed56dc12879cae9213 AS runtime

# Fixed, non-root identity (UID/GID 10001). No login shell, no home directory.
RUN groupadd --system --gid 10001 api \
 && useradd --system --uid 10001 --gid 10001 --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin api

ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=3000

WORKDIR /app

COPY --from=build /prod/api/package.json ./package.json
COPY --from=build /prod/api/dist ./dist
COPY --from=build /prod/api/node_modules ./node_modules

USER 10001:10001

EXPOSE 3000

CMD ["node", "dist/server.js"]
