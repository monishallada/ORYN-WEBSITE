# Railway's PostgreSQL 18 image plus PostGIS — for the existing `Postgres`
# service, whose volume was initialised by ghcr.io/railwayapp-templates/postgres-ssl:18.
#
# ORYN's migrations need PostGIS, which Railway's default image does not ship.
# Deriving from the same image (same PostgreSQL 18 binaries, Debian release,
# glibc collations, SSL and volume-safety wrapper) and adding only the PostGIS
# package keeps the existing data directory valid; nothing else changes.
#
# Railway service settings: source = this repository, RAILWAY_DOCKERFILE_PATH
# (or Dockerfile path) = deploy/railway/postgres/Dockerfile, watch paths =
# deploy/railway/postgres/** so application pushes never redeploy the database.
FROM ghcr.io/railwayapp-templates/postgres-ssl:18.6@sha256:fcc6686a3f4f1962fe4ed77a15884553b7bd611ae1cea3204687968c5c09d517

RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-18-postgis-3=3.6.4+dfsg-2.pgdg13+1 \
 && rm -rf /var/lib/apt/lists/*
