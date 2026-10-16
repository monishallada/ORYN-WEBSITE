# ORYN production images (one Dockerfile, three uses):
#
#   docker build --target web    -t oryn-web    .   # Next.js web service      → node server.js
#   docker build --target worker -t oryn-worker .   # background worker       → node dist/worker.mjs
#   (migration job = the worker image)                                      → node dist/migrate.mjs
#
# NEXT_PUBLIC_* values are compiled into the web build (pass them as build
# args); everything else is runtime environment — see docs/DEPLOYMENT.md.
# No secrets are needed or used at build time.

ARG NODE_IMAGE=node:22-bookworm-slim

# ── Dependencies (all, for building) ───────────────────────────
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ── Build: Next.js standalone server + bundled worker/CLIs ─────
FROM deps AS build
ARG NEXT_PUBLIC_PLATFORM_ENABLED=true
ARG NEXT_PUBLIC_SITE_URL=
ARG NEXT_PUBLIC_COMMAND_URL=
ARG NEXT_PUBLIC_CONTACT_EMAIL=
ARG ORYN_APP_VERSION=dev
ENV NEXT_TELEMETRY_DISABLED=1 \
    ORYN_STANDALONE_BUILD=1 \
    NEXT_PUBLIC_PLATFORM_ENABLED=${NEXT_PUBLIC_PLATFORM_ENABLED} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_COMMAND_URL=${NEXT_PUBLIC_COMMAND_URL} \
    NEXT_PUBLIC_CONTACT_EMAIL=${NEXT_PUBLIC_CONTACT_EMAIL} \
    ORYN_APP_VERSION=${ORYN_APP_VERSION}
COPY . .
RUN npm run build && npm run build:scripts

# ── Production dependencies only (worker/CLI externals) ────────
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# ── Web service ────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS web
WORKDIR /app
ARG ORYN_APP_VERSION=dev
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 ORYN_SERVICE=web ORYN_APP_VERSION=${ORYN_APP_VERSION}
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# Read by the readiness check and the startup preflight (pending-migration detection).
COPY --from=build --chown=node:node /app/db/migrations ./db/migrations
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

# ── Worker (also runs the migration job and operator CLIs) ─────
FROM ${NODE_IMAGE} AS worker
WORKDIR /app
ARG ORYN_APP_VERSION=dev
ENV NODE_ENV=production ORYN_SERVICE=worker ORYN_WORKER_HEALTH_PORT=8081 ORYN_APP_VERSION=${ORYN_APP_VERSION}
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/db/migrations ./db/migrations
USER node
EXPOSE 8081
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.ORYN_WORKER_HEALTH_PORT||8081)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/worker.mjs"]
