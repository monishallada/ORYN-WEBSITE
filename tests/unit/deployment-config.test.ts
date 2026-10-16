/**
 * Guards for the deployment layout: one Dockerfile per service whose final
 * stage is that service (platforms such as Railway cannot select a build
 * target), node started directly so SIGTERM reaches it, no secrets as build
 * args, and the health-port / version fallbacks container platforms rely on.
 */
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "@/server/config/env";

const read = (f: string) => readFileSync(f, "utf8");
const stages = (src: string) => [...src.matchAll(/^FROM\s+\S+(?:\s+AS\s+(\S+))?/gim)].map((m) => m[1] ?? "(unnamed)");
const lastCmd = (src: string) => [...src.matchAll(/^CMD\s+(.+)$/gm)].at(-1)?.[1];

describe("service Dockerfiles", () => {
  it.each([
    ["Dockerfile.web", "web", '["node", "server.js"]'],
    ["Dockerfile.worker", "worker", '["node", "dist/worker.mjs"]'],
  ])("%s ends in the %s stage and starts node directly", (file, stage, cmd) => {
    const src = read(file);
    expect(stages(src).at(-1)).toBe(stage);
    expect(lastCmd(src)).toBe(cmd);
    expect(src).toMatch(/^USER node$/m);
    expect(src).toMatch(/NODE_ENV=production/);
    expect(src).toMatch(/COPY --from=build --chown=node:node \/app\/db\/migrations \.\/db\/migrations/);
  });

  it("the worker image carries the bundles the migration job and CLIs need; the web image does not build them", () => {
    const worker = read("Dockerfile.worker");
    expect(worker).toMatch(/RUN npm run build:scripts/);
    expect(worker).toMatch(/COPY --from=build --chown=node:node \/app\/dist \.\/dist/);
    expect(worker).not.toMatch(/npm run build(?!:)/);
    expect(read("Dockerfile.web")).not.toMatch(/build:scripts|\/app\/dist/);
  });

  it("the root Dockerfile refuses to build a default service", () => {
    const src = read("Dockerfile");
    expect(src).toMatch(/exit 1/);
    expect(src).toMatch(/Dockerfile\.web/);
    expect(src).toMatch(/Dockerfile\.worker/);
  });

  it("takes no secrets as build arguments and keeps local secrets and data out of the build context", () => {
    for (const f of ["Dockerfile.web", "Dockerfile.worker"]) {
      const args = [...read(f).matchAll(/^ARG\s+([A-Z0-9_]+)/gm)].map((m) => m[1]!);
      expect(args.filter((a) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE/.test(a))).toEqual([]);
    }
    const ignore = read(".dockerignore").split("\n").map((l) => l.trim());
    for (const p of [".env*", "var", "dist", "node_modules", ".git"]) expect(ignore).toContain(p);
  });

  it("the Railway database image is Railway's pinned PostgreSQL 18 image plus only PostGIS", () => {
    const src = read("deploy/railway/postgres/Dockerfile");
    const from = [...src.matchAll(/^FROM\s+(\S+)/gm)].map((m) => m[1]);
    // One stage, same major version as the existing volume, pinned by digest.
    expect(from).toEqual([expect.stringMatching(/^ghcr\.io\/railwayapp-templates\/postgres-ssl:18(\.\d+)?@sha256:[0-9a-f]{64}$/)]);
    expect(src).toMatch(/apt-get install -y --no-install-recommends postgresql-18-postgis-3=\S+/);
    // Keeps the base image's entrypoint (SSL certificates, volume checks) and command.
    expect(src).not.toMatch(/^(ENTRYPOINT|CMD|USER|ENV|VOLUME)\b/m);
  });
});

describe("container platform fallbacks", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("in production the worker health server follows PORT unless ORYN_WORKER_HEALTH_PORT is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ORYN_WORKER_HEALTH_PORT", "");
    vi.stubEnv("PORT", "9123");
    expect(env.workerHealthPort()).toBe(9123);
    vi.stubEnv("ORYN_WORKER_HEALTH_PORT", "8081");
    expect(env.workerHealthPort()).toBe(8081);
  });

  it("outside production the worker never takes PORT (it may belong to the dev web server)", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ORYN_WORKER_HEALTH_PORT", "");
    vi.stubEnv("PORT", "3000");
    expect(env.workerHealthPort()).toBe(0);
  });

  it("reports the deployed commit as the version when none is given", () => {
    vi.stubEnv("ORYN_APP_VERSION", "");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
    vi.stubEnv("RAILWAY_GIT_COMMIT_SHA", "2b43a26d1edb0e9a10238f94e6b87dd5ef960a6e");
    expect(env.appVersion()).toBe("2b43a26d1edb");
    vi.stubEnv("ORYN_APP_VERSION", "v1.2.3");
    expect(env.appVersion()).toBe("v1.2.3");
    vi.stubEnv("ORYN_APP_VERSION", "");
    vi.stubEnv("RAILWAY_GIT_COMMIT_SHA", "");
    expect(env.appVersion()).toBe("dev");
  });
});

describe("database TLS on private networks", () => {
  afterEach(() => vi.unstubAllEnvs());
  const CA = "-----BEGIN CERTIFICATE-----\nMIIBfakeCAcertificateForTests\n-----END CERTIFICATE-----";

  it("without a CA: pg gets libpq's sslmode=require; other modes and postgres.js are left to the URL", async () => {
    const { pgConnectionOptions, postgresTlsOptions } = await import("@/server/db/tls");
    vi.stubEnv("DATABASE_CA_CERT", "");
    expect(pgConnectionOptions("postgres://u:p@db.railway.internal:5432/railway?sslmode=require&application_name=x")).toEqual({
      connectionString: "postgres://u:p@db.railway.internal:5432/railway?application_name=x",
      ssl: { rejectUnauthorized: false },
    });
    for (const url of ["postgres://u:p@db.example.org/oryn?sslmode=verify-full", "postgres://u:p@localhost/oryn"]) {
      expect(pgConnectionOptions(url)).toEqual({ connectionString: url });
      // No `ssl` key at all: postgres.js treats a present-but-undefined `ssl` as "no TLS".
      expect(Object.keys(postgresTlsOptions(url))).toEqual([]);
    }
  });

  it("with DATABASE_CA_CERT: verify-full checks chain and host name in both clients; verify-ca checks the chain", async () => {
    const { pgConnectionOptions, postgresTlsOptions } = await import("@/server/db/tls");
    vi.stubEnv("DATABASE_CA_CERT", CA.replace(/\n/g, "\\n")); // single-line secret stores
    const full = "postgres://u:p@postgres.railway.internal:5432/railway?sslmode=verify-full";
    const pjs = postgresTlsOptions(full).ssl!;
    expect(pjs).toMatchObject({ ca: CA, rejectUnauthorized: true });
    const pgo = pgConnectionOptions(full);
    expect(pgo.connectionString).toBe("postgres://u:p@postgres.railway.internal:5432/railway");
    expect(pgo.ssl).toMatchObject({ ca: CA, rejectUnauthorized: true });
    // The host name is checked against the URL's host, whatever server name the client sent.
    const cert = { subject: { CN: "localhost" }, subjectaltname: "DNS:localhost, DNS:postgres.railway.internal" } as never;
    for (const check of [pjs.checkServerIdentity!, pgo.ssl!.checkServerIdentity!]) {
      expect(check("localhost", cert)).toBeUndefined();
    }
    const ipUrl = full.replace("postgres.railway.internal", "10.0.0.5");
    expect(postgresTlsOptions(ipUrl).ssl!.checkServerIdentity!("localhost", cert)).toBeInstanceOf(Error);
    const ca = postgresTlsOptions(full.replace("verify-full", "verify-ca")).ssl!;
    expect(ca).toMatchObject({ ca: CA, rejectUnauthorized: true });
    expect(ca.checkServerIdentity?.("other.host", {} as never)).toBeUndefined();
    // A CA never weakens other modes.
    expect(pgConnectionOptions(full.replace("verify-full", "require")).ssl).toEqual({ rejectUnauthorized: false });
    expect(Object.keys(postgresTlsOptions(full.replace("?sslmode=verify-full", "")))).toEqual([]);
  });

  it("refuses a DATABASE_CA_CERT that is not a PEM certificate", async () => {
    const { postgresTlsOptions } = await import("@/server/db/tls");
    vi.stubEnv("DATABASE_CA_CERT", "not-a-certificate");
    expect(() => postgresTlsOptions("postgres://u:p@h/db?sslmode=verify-full")).toThrow(/not a PEM certificate/);
  });
});
