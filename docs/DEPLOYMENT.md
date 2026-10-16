# Deploying ORYN

This is the deployment contract for the ORYN web service and background worker: what to run, what to configure, how to migrate and roll back, and what the services check before they accept traffic. **Nothing in this repository has been deployed**; every statement about "verified" below refers to the tests and local production rehearsal described at the end, not to a hosting provider.

## Services

| Service | Image / command | Runs | Needs |
| --- | --- | --- | --- |
| **web** | `Dockerfile.web` → `node server.js` (listens on `PORT`, default 3000) | Continuously, ≥ 1 replica behind HTTPS | PostgreSQL (app role), S3 bucket |
| **worker** | `Dockerfile.worker` → `node dist/worker.mjs` (health server on `ORYN_WORKER_HEALTH_PORT`, else `PORT`, default 8081) | Continuously, ≥ 1 replica. **Not** serverless: imagery processing is CPU- and network-heavy and jobs run for minutes | PostgreSQL (app role), S3 bucket, outbound HTTPS to providers |
| **migrate** | `Dockerfile.worker` image → `node dist/migrate.mjs` | Once per release, **before** web/worker start | PostgreSQL (owner role) |
| PostgreSQL | managed or self-hosted | — | PostgreSQL 15+ with PostGIS 3.4+ and `citext` (tested: 17 / 3.5) |
| Object storage | S3-compatible, **private** bucket | — | SigV4 credentials; SSE-S3 (default) |

Operator CLIs ship in the worker image: `node dist/admin.mjs`, `node dist/accounts.mjs`, `node dist/verify.mjs`, `node dist/migrate.mjs --status`.

Sizing has **not** been load-tested. Starting points: web 1 vCPU / 1 GB; worker 2 vCPU / 3 GB with `ORYN_WORKER_CONCURRENCY=2` (each analysis holds a few raster grids in memory); database 2 vCPU / 4 GB with point-in-time recovery. Measure before committing.

The optional `/api/cron/tick` endpoint (scheduler tick + up to 25 jobs) exists for hosts without a long-running worker. It is covered by tests but not used in any rehearsal; prefer the worker.

## Build

Each service has its own Dockerfile whose **final stage is that service**, so no build-target selection is needed (some platforms, including Railway, cannot select a target stage):

```bash
docker build -f Dockerfile.web    -t oryn-web:$VERSION    --build-arg ORYN_APP_VERSION=$VERSION \
  --build-arg NEXT_PUBLIC_PLATFORM_ENABLED=true --build-arg NEXT_PUBLIC_SITE_URL=https://oryn.example.org .
docker build -f Dockerfile.worker -t oryn-worker:$VERSION --build-arg ORYN_APP_VERSION=$VERSION .
```

The root `Dockerfile` intentionally fails with a message naming the two service Dockerfiles, so a platform that builds `./Dockerfile` by default cannot deploy the wrong service by accident.

`NEXT_PUBLIC_*` values are compiled into the web build (marketing pages are prerendered) — pass them as build args. No secret is needed or read at build time; `.dockerignore` keeps `.env*` files out of the build context. Images run as the unprivileged `node` user and start node directly (exec form), so SIGTERM reaches the process. `ORYN_APP_VERSION` may be omitted: the version then falls back to `RAILWAY_GIT_COMMIT_SHA` (or `VERCEL_GIT_COMMIT_SHA`) at runtime, else `dev`.

## Railway

This section is the exact Railway setup for the images above. It uses only documented service settings and variables — `RAILWAY_DOCKERFILE_PATH` selects each service's Dockerfile — and adds **no** `railway.json`: Railway documents Config as Code as deprecated (existing files work for legacy services until 2026-12-01, superseded by Infrastructure as Code). None of this has been deployed; verify each setting in the Railway dashboard as you create the services.

Create one Railway **project** with these services, all connected to this GitHub repository (except the database):

| Service | Source | Key settings |
| --- | --- | --- |
| `oryn-db` | PostgreSQL **with PostGIS**. Railway's default PostgreSQL image (`ghcr.io/railwayapp-templates/postgres-ssl:18`) has `citext` but **no PostGIS** (checked), and the PostGIS template is PostgreSQL 17 only, which cannot open a PostgreSQL 18 volume. For an existing default PostgreSQL 18 service, build [`deploy/railway/postgres/Dockerfile`](../deploy/railway/postgres/Dockerfile) instead: Railway's own pinned image plus only the PostGIS package, so the data directory, SSL certificates, and volume checks are unchanged (rehearsed locally: data written by the default image survives, then `roles.sql` and all migrations apply). Service source = this repository, Dockerfile path `deploy/railway/postgres/Dockerfile`, **watch paths** `deploy/railway/postgres/**` so application pushes never redeploy the database | Run `db/production/roles.sql` once as its admin user (One-time setup, step 1) |
| `oryn-migrate` | GitHub repo | Variable `RAILWAY_DOCKERFILE_PATH=Dockerfile.worker`; **Custom start command** `node dist/migrate.mjs`; **Restart policy** Never; no health check, no public domain; variables: `DATABASE_OWNER_URL` (and `NODE_ENV=production`, already set in the image). Nothing else — it is the only service with owner credentials |
| `oryn-worker` | GitHub repo | Variable `RAILWAY_DOCKERFILE_PATH=Dockerfile.worker` (default start command `node dist/worker.mjs`); **Health check path** `/readyz`; variable `PORT=8081` (the health server listens on `PORT`; setting it makes the probed port explicit); `RAILWAY_DEPLOYMENT_DRAINING_SECONDS=45` (default is 0 — without it in-flight jobs are killed instead of drained); restart policy On failure; **no public domain** |
| `oryn-web` | GitHub repo | Variable `RAILWAY_DOCKERFILE_PATH=Dockerfile.web`; **Health check path** `/api/health/ready` (200 only when the database, migrations, and storage work); generate a domain (the `https://…up.railway.app` URL); `RAILWAY_DEPLOYMENT_DRAINING_SECONDS=10`; Railway injects `PORT` and the server listens on it |

A service whose `RAILWAY_DOCKERFILE_PATH` is missing builds the root `Dockerfile`, which fails on purpose with an explanation.

**Variables.** Use the production checklist below. Railway specifics:

* Build-time (web): `NEXT_PUBLIC_PLATFORM_ENABLED=true` and `NEXT_PUBLIC_SITE_URL=https://<generated>.up.railway.app` must be set **before the first web build** — Railway passes service variables to the `ARG`s declared in `Dockerfile.web`, and they are compiled in. Changing them requires a rebuild.
* Runtime (web): `BETTER_AUTH_URL=https://<generated>.up.railway.app`, `BETTER_AUTH_SECRET`, `DATABASE_URL` (the `oryn_app` role — use a Railway variable reference to the database service's private host with the `oryn_app` credentials, never the template's admin user), `ORYN_STORAGE_DRIVER=s3` and `ORYN_S3_*`.
* Runtime (worker): the same `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (the worker builds links in alert emails from it and names it as the contact in provider User-Agents — without it both say `http://localhost:3000`), storage variables, and provider variables (`NWS_USER_AGENT` with a contact, optional keys). **Not** `DATABASE_OWNER_URL`.
* Storage: a Railway **Bucket** (private; public buckets are not supported). Give web and worker `ORYN_STORAGE_DRIVER=s3` and variable references to the bucket's `BUCKET`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`, `REGION`, `ENDPOINT` (as `ORYN_S3_BUCKET`, `ORYN_S3_ACCESS_KEY_ID`, …), so the keys are never copied by hand. Set **`ORYN_S3_SSE=none`**: Railway buckets are encrypted at rest but reject the server-side-encryption request header. Buckets use virtual-hosted URLs (leave `ORYN_S3_FORCE_PATH_STYLE` unset) and are reachable only over the public network, so uploads count as service egress.
* Trial / small plans cap each service's memory (1 GB on the trial): run the worker with `ORYN_WORKER_CONCURRENCY=1`.
* `ORYN_TRUSTED_PROXIES`: leave unset at first and check that sign-in rate limits are per client (several failed sign-ins from one address must not lock out another address). Railway's forwarding header format has not been verified here.
* The private network between Railway services does not use TLS; the preflight `db_tls` warning is expected for a `*.railway.internal` host and is not an error.

**Deployment order — first deploy and every release with new migrations**

1. `oryn-db` running; `roles.sql` applied once.
2. Deploy `oryn-migrate`; its log must end with `migrations: N applied, M already applied` and the deployment must exit successfully. To inspect without changing anything, temporarily set its start command to `node dist/migrate.mjs --status`.
3. Deploy `oryn-worker`; wait until its health check (`/readyz`) passes.
4. Deploy `oryn-web`; wait until `/api/health/ready` passes; open the generated URL.
5. One-off checks from the worker image (Railway shell/one-off run on `oryn-worker`, which has the app-role variables): `node dist/verify.mjs database`, `node dist/verify.mjs storage`.

If web or worker deploy before migrations are applied, their preflight refuses to start (`migrations_pending`), the health check fails, and Railway keeps the previous deployment serving — redeploy them after step 2. Releases without migrations can deploy worker and web directly (`oryn-migrate` just reports "0 applied").

Alternative to the `oryn-migrate` service: a **Pre-deploy command** `node dist/migrate.mjs` on `oryn-worker` runs migrations before every worker deploy, in a separate container from the worker image. It needs `DATABASE_OWNER_URL` in the worker's variables (the preflight warns `owner_url_in_service`), so the dedicated service is the least-privilege choice. The web image does not contain the migration runner.

**Not done here:** no Railway project, service, database, bucket, domain, or variable has been created; the PostGIS template, the injected `PORT`, draining behaviour, and forwarding headers are as documented by Railway, not verified on a deployment.

## One-time setup

1. **Database roles.** As the provider's admin user, with passwords generated into your secret store:
   ```bash
   psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -v owner_password="$OWNER_PW" -v app_password="$APP_PW" -f db/production/roles.sql
   ```
   This creates the extensions, `oryn_owner` (owns the schema; migrations only), `oryn_app_role`, and `oryn_app` (login for web and worker: not superuser, no `BYPASSRLS`, cannot create roles or databases). Use `?sslmode=verify-full` (with the provider's CA) in both connection URLs.
2. **Bucket.** Create a private bucket (block all public access; no bucket policy granting anonymous reads), enable default encryption and versioning, and an access key limited to `GetObject`, `PutObject`, `DeleteObject` on that bucket. ORYN never issues public or presigned URLs; downloads stream through authorized routes.
3. **Migrate**, then start worker and web (next section).
4. **First platform administrator** — a one-off container with the owner URL (granting platform administration is an owner-only write):
   ```bash
   docker run --rm --env-file web.env -e DATABASE_OWNER_URL -e ORYN_ADMIN_PASSWORD oryn-worker:$VERSION \
     node dist/admin.mjs create --email ops@example.org --name "Ops Lead" --username ops.lead
   ```
   Without `ORYN_ADMIN_PASSWORD` a temporary password is printed once. Partner accounts: `node dist/accounts.mjs create …` or `/app/admin/accounts` — see [OPERATIONS.md → Accounts](OPERATIONS.md#accounts). Do **not** provision the shared trial account (`OrynTest`) with a demonstration password in production; it can only reach synthetic trial workspaces, but its password is shared and effectively public.
5. **Verify** the deployment's integrations (below) before enabling any gated integration.

## Release procedure

```bash
# 0. Snapshot / confirm point-in-time recovery for the database.
# 1. What will change (read-only):
docker run --rm -e DATABASE_OWNER_URL oryn-worker:$NEW node dist/migrate.mjs --status
# 2. Apply (advisory-locked, one transaction per migration, lock_timeout 15 s):
docker run --rm -e DATABASE_OWNER_URL -e ORYN_SERVICE=migrate oryn-worker:$NEW node dist/migrate.mjs
# 3. Roll out worker, then web. Each refuses to start if migrations are pending,
#    the app role can bypass RLS, or the configuration is unsafe (preflight).
# 4. Check: GET /api/health/ready → 200; worker GET :<health port>/readyz → 200;
docker run --rm --env-file web.env oryn-worker:$NEW node dist/verify.mjs database
docker run --rm --env-file web.env oryn-worker:$NEW node dist/verify.mjs storage
```

Give the worker a stop grace period of **≥ 45 s**: on SIGTERM it stops claiming, lets in-flight jobs finish for 30 s, then exits; jobs still running are reclaimed by another worker after their heartbeat lapses (2 min) and retried — never lost. Several worker replicas are safe (jobs are claimed with `FOR UPDATE SKIP LOCKED`; scheduler enqueues are idempotent).

## Migrations and rollback

Migrations are **forward-only** SQL files (`db/migrations`), checksummed in `schema_migrations`; an edited applied migration stops the runner. Write them **expand → contract**: add columns/tables in one release, start using them in the same or next release, remove old ones only in a later release once no running version needs them. The web and worker refuse to start against a database with **pending** migrations; they start (with a warning) against a database that has **newer** migrations than they know, which is what a rollback looks like.

| Situation | Action |
| --- | --- |
| Release is bad, its migrations are additive | Roll back the web/worker images only. Re-check readiness. |
| A migration failed | It rolled back atomically (no partial schema). Fix forward with a new migration; the previous images keep running. |
| A migration was destructive or data is wrong | Restore the snapshot / point-in-time recovery from step 0 into a new database, point the services at it, then roll the images back. Data written since the snapshot is lost — export what you need first. |

Release-specific notes:

* **0006 (partner accounts)** — additive, but rolling the *code* back below 0006 removes enforcement of disabled accounts, forced password changes, and trial isolation while those rows remain. Do not roll back below 0006 while partner accounts exist; fix forward.
* **0007 (operations)** — additive (request slots, worker heartbeats, `skipped` sync-run status, read grant on `schema_migrations`). Earlier code ignores it; safe to roll images back.

Each migration also takes `lock_timeout = 15s`, so a migration that cannot get a table lock fails fast instead of stalling application queries; re-run it at a quieter time.

## Health checks and logs

| Endpoint | Meaning |
| --- | --- |
| web `GET /api/health` | Liveness — the process serves requests. No dependencies. |
| web `GET /api/health/ready` | Readiness — `200` only when a query as the app role works, migrations match this release, and a storage write/read/delete succeeds (cached 60 s). Reports worker heartbeat freshness (informational). Returns states only, never error text. |
| worker `GET :<port>/healthz` | Loop alive (not stuck). Port: `ORYN_WORKER_HEALTH_PORT`, else `PORT` (production), image default 8081 |
| worker `GET :<port>/readyz` | Loop alive and the database answered within the last minute |

Both images declare a Docker `HEALTHCHECK`. Logs are JSON lines (`t`, `level`, `msg`, `svc`, fields) on stdout/stderr with credentials, bearer tokens, API keys, and signed-URL query strings redacted; Next.js's own startup lines are plain text. Alert on: `preflight` errors, `job.failed` with `next: "dead"` or `"failed"`, `readiness.check_failed`, `worker.fatal`, and provider status `unavailable` for > 2 h.

## Production environment checklist

Secrets (●) belong in the platform's secret store, never in images, files in the repository, or logs. "web/worker" means both.

| Variable | Service | Required | Notes |
| --- | --- | --- | --- |
| `NODE_ENV=production` | all | yes | Set by the images |
| `DATABASE_URL` ● | web/worker | yes | `oryn_app` role, `?sslmode=verify-full` |
| `DATABASE_OWNER_URL` ● | migrate, `admin.mjs grant/revoke` | migrate only | `oryn_owner`. **Not** in web/worker (preflight warns) |
| `BETTER_AUTH_SECRET` ● | web/worker | yes | `openssl rand -base64 48`; preflight refuses short/known/low-variety values |
| `BETTER_AUTH_URL` | web/worker | yes | Public `https://` URL. The worker uses it for links in alert emails and as the provider User-Agent contact |
| `NEXT_PUBLIC_PLATFORM_ENABLED`, `NEXT_PUBLIC_SITE_URL` | web (build args) | yes | Compiled in at build time |
| `ORYN_STORAGE_DRIVER=s3` | web/worker | yes | `local` is refused unless `ORYN_ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true` (single server, persistent backed-up disk) |
| `ORYN_S3_BUCKET`, `ORYN_S3_REGION` | web/worker | yes | |
| `ORYN_S3_ACCESS_KEY_ID`, `ORYN_S3_SECRET_ACCESS_KEY` ● | web/worker | yes | Least-privilege key for this bucket |
| `ORYN_S3_ENDPOINT`, `ORYN_S3_FORCE_PATH_STYLE` | web/worker | non-AWS | `https://` only |
| `ORYN_S3_SSE` | web/worker | no | `AES256` (default) or `none` if the bucket enforces encryption itself |
| `NWS_USER_AGENT` | worker | for NWS | Must include a contact, e.g. `(oryn.example.org, ops@example.org)`; otherwise NWS stays off |
| `ORYN_API_CONTACT_EMAIL` | worker | recommended | Sent in provider User-Agents |
| `OVERPASS_URL` | worker | recommended | Dedicated instance; the public one is fair-use and caps results |
| `ORYN_TRUSTED_PROXIES` | web | behind multi-hop proxies | CIDRs; otherwise sign-in rate limits share one bucket |
| `ORYN_WORKER_HEALTH_PORT` | worker | no | Overrides the health port; otherwise `PORT` (image default 8081) |
| `ORYN_WORKER_CONCURRENCY`, `ORYN_WORKER_POLL_MS`, `ORYN_SCHEDULER_INTERVAL_MS` | worker | no | Defaults 2 / 2000 / 60000 |
| `ORYN_CRON_SECRET` ● | web | only if `/api/cron/tick` is used | ≥ 32 random characters |
| `OPEN_METEO_API_KEY` ● | worker | for Open-Meteo | Commercial licence. Without it Open-Meteo is **off** in production |
| `OPEN_METEO_ALLOW_NONCOMMERCIAL` | worker | no | Only for genuinely non-commercial deployments (licence attestation; preflight warns) |
| `ORYN_VERIFIED_INTEGRATIONS` | web/worker | no | Gated integrations verified in *this* deployment (below) |
| `RESEND_API_KEY` ●, `ORYN_EMAIL_FROM` | web/worker | for email | Verified sender domain; stays off until `email` is verified |
| `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` | web | for the contact form | Without them (and verified email) the form answers 503 |
| `EARTHDATA_TOKEN` ● | worker | for NASA HLS | Stays off until `nasa-hls` is verified |
| `ANTHROPIC_API_KEY` ●, `ORYN_AI_MODEL` | worker | optional | Stays off until `ai-summaries` is verified |
| `PLANETARY_COMPUTER_SUBSCRIPTION_KEY` ● | worker | optional | Anonymous access works |
| `ORYN_SESSION_MAX_AGE_SECONDS`, `ORYN_MAX_AOI_AREA_KM2`, `ORYN_MAX_UPLOAD_BYTES`, `LOG_LEVEL` | as named | no | Defaults are production-ready (`LOG_LEVEL=info`) |

**Must not be set** in any production service: `ORYN_ALLOW_SYNTHETIC_SEED` (refused), `ORYN_DEV_SEED_PASSWORD` and `E2E_PASSWORD` (refused), `ORYN_LOCAL_REHEARSAL` (refused unless the URL is localhost), and — outside a one-off CLI run — `ORYN_ADMIN_PASSWORD`, `ORYN_PROVISION_PASSWORD` (warned). `npm run db:seed` refuses `NODE_ENV=production` with no override.

Check a configuration without starting anything: `node dist/verify.mjs config` (worker image) prints every preflight finding for web, worker, and migrate.

## Integrations: verify before enabling

Integrations whose live behaviour was never verified stay **off in production** until an operator verifies them in that deployment and lists them in `ORYN_VERIFIED_INTEGRATIONS` (`src/server/integrations.ts`). The Data sources and settings pages show why each is off.

| Id | Verify with (worker image) | What it proves |
| --- | --- | --- |
| `email` | `node dist/verify.mjs email --to <address you control>` | Resend accepts a message (sends exactly one); confirm it arrived |
| `gdelt` | `node dist/verify.mjs gdelt` | One article search from this deployment's egress address succeeds |
| `nasa-hls` | `node dist/verify.mjs nasa-hls` | Earthdata token reads an HLS GeoTIFF header |
| `ai-summaries` | `node dist/verify.mjs ai-summaries` | Credentials and model access (synthetic text only — no tenant data) |

Always verified at each release: `verify.mjs database` (role privileges, RLS on every tenant table, migration state), `verify.mjs storage` (write/read/delete; anonymous read refused; encryption header), `verify.mjs providers` (health probes of enabled providers).

Never enabled: Copernicus Data Space downloads (ORYN cannot read its JPEG 2000 products; catalog search only).

## Licensing obligations that remain the operator's

* **Open-Meteo:** the free API is non-commercial only — buy a key for commercial use.
* **OpenStreetMap / Overpass:** attribute "© OpenStreetMap contributors"; derived databases are share-alike (ODbL); use a dedicated Overpass instance for production volume.
* **Copernicus Sentinel, ESA WorldCover, IO LULC (CC BY 4.0), GDELT:** attribution travels with reports and exports (`license_notes`); keep it when redistributing.
* **NWS:** public domain; do not present modified products as official; identify yourself in the User-Agent.
* **Basemaps (OpenFreeMap, USGS, FEMA):** no uptime guarantee; FEMA flood zones are regulatory, not observed flooding.
* **Anthropic:** enabling AI summaries sends report findings (tenant data) to a third party — a data-processing decision for each organization.

## Local rehearsal (production images on one machine)

```bash
docker compose up -d db
docker compose --profile s3 up -d s3
docker compose exec db psql -U oryn_owner -d oryn -c "create database oryn_rehearsal"
# create the private bucket "oryn-rehearsal" (any SigV4 client; keys in deploy/rehearsal/)
export ORYN_REHEARSAL_AUTH_SECRET="$(openssl rand -base64 48)"
docker compose --profile rehearsal up --build migrate web worker
```

The services run with `NODE_ENV=production`, S3 storage (SeaweedFS, SigV4 + SSE-S3), and the full preflight; `ORYN_LOCAL_REHEARSAL=true` relaxes only HTTPS, the development database password, and plain-HTTP local S3, and only because the URL is `http://localhost:3000`. Browser tests run against it with `E2E_BASE_URL=http://localhost:3000` and the rehearsal database URLs in the environment.

## Not verified — do not assume

* Any hosting provider, managed PostgreSQL service, or AWS S3/R2/GCS (the S3 driver is verified against SeaweedFS only).
* Behaviour under load, multi-region, or with several web replicas behind a real load balancer.
* Email delivery, GDELT from a production egress address, NASA HLS reads, AI summaries (gated off until verified).
* Backup and restore procedures of the chosen database service (rehearse a restore before go-live).
