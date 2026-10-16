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
