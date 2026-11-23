# syntax=docker/dockerfile:1

# Pinned by minor version: patch updates (security fixes) arrive on rebuild, behaviour doesn't drift.
# Must stay >= 22.12: @scalar/express-api-reference is ESM-only and relies on require(esm).
ARG NODE_IMAGE=node:22.23-alpine

# ---- deps: full install (incl. dev deps) for building. Manifests only, so this layer is
# cached until package.json / package-lock.json change.
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci

# ---- build: compile the server (its build also copies SQL migrations into dist) and the client
# if it has a build script yet. COPY can't be conditional, so client/dist always exists; when
# it's empty (no index.html) the app skips the SPA.
FROM deps AS build
COPY tsconfig.base.json ./
COPY server/ server/
COPY client/ client/
RUN npm run build -w server \
 && npm run build -w client --if-present \
 && mkdir -p client/dist

# ---- runtime: production deps of the server workspace only, compiled output, no sources.
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
# npm needs every workspace manifest listed in the lockfile, even ones it won't install.
COPY client/package.json client/
RUN npm ci --omit=dev -w server && npm cache clean --force

# Files stay root-owned, so the unprivileged runtime user can read but not modify the app.
COPY --from=build /app/server/dist server/dist
# DEFAULT_OPENAPI_SPEC_PATH resolves dist/utils/../../../docs -> /app/docs/openapi.yaml.
COPY docs/openapi.yaml docs/openapi.yaml
# DEFAULT_CLIENT_DIST_PATH resolves dist/middlewares/../../../client/dist -> /app/client/dist.
COPY --from=build /app/client/dist client/dist

USER node
WORKDIR /app/server
EXPOSE 3000

# Alpine has no curl; Node 22 has fetch. /api/health also pings the database.
# start-period covers migrations + seed before the server listens.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

# Exec form: node is PID 1 and receives SIGTERM directly; server.ts shuts down gracefully.
# start.js runs migrations, then the seed when SEED_ON_START=true, then starts the server.
CMD ["node", "dist/start.js"]
