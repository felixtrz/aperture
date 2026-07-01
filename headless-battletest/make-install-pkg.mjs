#!/usr/bin/env node
// Generates a package.json that installs Aperture from the local tarballs.
// Usage: node make-install-pkg.mjs <mode> <outDir>
//   mode "toolbox" -> depends on the CLI only (to run `aperture create`).
//   mode "app"     -> merges overrides into an existing scaffolded package.json.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const tarballs = JSON.parse(
  readFileSync(path.join(here, "tarballs.json"), "utf8"),
);
const fileUrl = (name) => pathToFileURL(tarballs[name]).href;
const overrides = Object.fromEntries(
  Object.keys(tarballs).map((name) => [name, fileUrl(name)]),
);

const mode = process.argv[2];
const outDir = path.resolve(process.argv[3]);

if (mode === "toolbox") {
  const pkg = {
    name: "aperture-toolbox",
    private: true,
    type: "module",
    dependencies: { "@aperture-engine/cli": fileUrl("@aperture-engine/cli") },
    pnpm: { overrides },
  };
  writeFileSync(
    path.join(outDir, "package.json"),
    JSON.stringify(pkg, null, 2) + "\n",
  );
  console.log(`wrote toolbox package.json to ${outDir}`);
} else if (mode === "app") {
  const pkgPath = path.join(outDir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  // Redirect every @aperture-engine/* spec (dependency or transitive) to the
  // local tarball, exactly as a registry install would resolve them.
  for (const field of ["dependencies", "devDependencies"]) {
    if (!pkg[field]) continue;
    for (const dep of Object.keys(pkg[field])) {
      if (overrides[dep]) pkg[field][dep] = overrides[dep];
    }
  }
  pkg.pnpm = { ...(pkg.pnpm ?? {}), overrides };
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`patched app package.json at ${pkgPath} with tarball overrides`);
} else {
  console.error(`unknown mode: ${mode}`);
  process.exit(1);
}
