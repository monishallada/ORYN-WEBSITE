// Copies browser assets that must be served as standalone files (not bundled)
// into public/vendor. Runs before `dev` and `build`; the output is gitignored.
//  - MapLibre GL's web worker: MapLibre derives the worker URL from its own
//    module URL, which no longer holds once the library is bundled.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const pkg = JSON.parse(readFileSync(path.join(root, "node_modules/maplibre-gl/package.json"), "utf8"));
const outDir = path.join(root, "public/vendor/maplibre");
mkdirSync(outDir, { recursive: true });
copyFileSync(path.join(root, "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs"), path.join(outDir, `maplibre-gl-worker-${pkg.version}.mjs`));
console.log(`vendor: maplibre-gl-worker-${pkg.version}.mjs`);
