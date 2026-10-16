# ORYN has one Dockerfile per service; there is deliberately no default image.
#
#   Web service:  Dockerfile.web     (docker build -f Dockerfile.web -t oryn-web .)
#   Worker:       Dockerfile.worker  (docker build -f Dockerfile.worker -t oryn-worker .)
#                 — also runs the migration job: node dist/migrate.mjs
#
# Railway builds ./Dockerfile when RAILWAY_DOCKERFILE_PATH is not set. This
# file fails that build with an explanation, instead of silently deploying the
# wrong service. Set RAILWAY_DOCKERFILE_PATH on every service (docs/DEPLOYMENT.md).

ARG NODE_IMAGE=node:22-bookworm-slim
FROM ${NODE_IMAGE}
RUN echo "ORYN: choose a service Dockerfile — set RAILWAY_DOCKERFILE_PATH=Dockerfile.web or Dockerfile.worker (or docker build -f …). See docs/DEPLOYMENT.md." >&2 && exit 1
