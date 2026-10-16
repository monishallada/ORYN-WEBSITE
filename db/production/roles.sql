-- ORYN production database roles. Run ONCE per database, as the provider's
-- administrative user (RDS master user, Cloud SQL postgres, Azure admin, …),
-- BEFORE the first migration. Passwords are psql variables — never edit them
-- into this file:
--
--   psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 \
--        -v owner_password="$(openssl rand -base64 36)" \
--        -v app_password="$(openssl rand -base64 36)" \
--        -f db/production/roles.sql
--
-- (Capture the two generated passwords into your secret store as part of the
-- same step, e.g. generate them first into variables.)
--
-- Result:
--   oryn_owner     owns the schema; runs migrations (DATABASE_OWNER_URL, migration job only)
--   oryn_app_role  group role that holds table privileges (granted by migration 0001)
--   oryn_app       login used by the web service and worker (DATABASE_URL):
--                  NOT superuser, NO BYPASSRLS, cannot create roles or databases —
--                  so PostgreSQL row-level security applies to every query.
--
-- The services verify this at startup (preflight) and refuse to run otherwise.

\set ON_ERROR_STOP on

-- Extensions need elevated rights on most managed services; create them here.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS citext;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oryn_app_role') THEN
    CREATE ROLE oryn_app_role NOLOGIN;
  END IF;
END
$$;

SELECT format('CREATE ROLE oryn_owner LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE', :'owner_password')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oryn_owner') \gexec

SELECT format('CREATE ROLE oryn_app LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE INHERIT CONNECTION LIMIT 100', :'app_password')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oryn_app') \gexec

GRANT oryn_app_role TO oryn_app;

-- The owner creates the schema's objects and grants privileges on them to
-- oryn_app_role (granting TO a role needs no membership in it — the owner is
-- deliberately NOT a member of oryn_app_role).
SELECT format('GRANT CONNECT ON DATABASE %I TO oryn_owner, oryn_app', current_database()) \gexec
GRANT CREATE, USAGE ON SCHEMA public TO oryn_owner;
-- PostGIS reference table (owned by the extension's owner, not oryn_owner).
GRANT SELECT ON spatial_ref_sys TO oryn_app_role;

-- Defence in depth: no one connects as the group role directly.
ALTER ROLE oryn_app_role NOLOGIN;
