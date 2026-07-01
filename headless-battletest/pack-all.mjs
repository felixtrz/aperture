#!/usr/bin/env node
// Packs every publishable Aperture code package to a .tgz in ./packs and
// prints a JSON map of { "@aperture-engine/<name>": "<tarball path>" }.
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(here, "..");
const packDir = path.join(here, "packs");
mkdirSync(packDir, { recursive: true });

// Order: leaf-first so a human reading the log sees the graph bottom-up.
const packages = [
  "@aperture-engine/math",
  "@aperture-engine/simulation",
  "@aperture-engine/physics",
  "@aperture-engine/physics-rapier",
  "@aperture-engine/render",
  "@aperture-engine/ui",
  "@aperture-engine/runtime",
  "@aperture-engine/webgpu",
  "@aperture-engine/audio",
  "@aperture-engine/vite-plugin",
  "@aperture-engine/app",
  "@aperture-engine/cli",
];

const tarballs = {};
for (const name of packages) {
  const started = process.hrtime.bigint();
  const result = spawnSync(
    "pnpm",
    ["--filter", name, "pack", "--json", "--pack-destination", packDir],
    { cwd: rootDir, encoding: "utf8" },
  );
  if (result.status !== 0) {
    console.error(`FAILED to pack ${name}:\n${result.stderr || result.stdout}`);
    process.exit(1);
  }
  const report = JSON.parse(result.stdout.trim());
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  tarballs[name] = report.filename;
  console.error(
    `packed ${name.padEnd(34)} -> ${path.basename(report.filename)} (${elapsedMs.toFixed(0)}ms)`,
  );
}

process.stdout.write(JSON.stringify(tarballs, null, 2) + "\n");
