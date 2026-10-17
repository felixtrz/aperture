#!/usr/bin/env node
// Explicit, reproducible CI provisioning. Rendering never installs a driver.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { brotliDecompressSync } from "node:zlib";
import { spawnSync } from "node:child_process";

const archive = process.argv[2];
const destination = path.resolve(
  process.argv[3] ?? ".aperture-env/dawn-runtime",
);
if (process.platform !== "linux" || process.arch !== "x64")
  throw new Error(
    "This pinned SwiftShader provisioning recipe is qualified for Linux x64 only.",
  );
if (archive === undefined)
  throw new Error(
    "Usage: node scripts/provision-dawn-software.mjs <@sparticuz/chromium@153.0.0/bin/swiftshader.tar.br> [output-directory]",
  );
const compressed = await readFile(archive);
const sha256 = createHash("sha256").update(compressed).digest("hex");
if (
  sha256 !== "b680e40a33235ecc6ad4c6897a168b70ce5164f0d62d2a64d675320d51614631"
)
  throw new Error(`Unqualified SwiftShader archive digest: ${sha256}`);
await mkdir(destination, { recursive: true });
const extracted = spawnSync("tar", ["-x", "-C", destination], {
  input: brotliDecompressSync(compressed),
  encoding: "utf8",
});
if (extracted.status !== 0)
  throw new Error(`SwiftShader extraction failed: ${extracted.stderr}`);
const manifest = {
  source: "@sparticuz/chromium@153.0.0/bin/swiftshader.tar.br",
  sha256,
  platform: process.platform,
  arch: process.arch,
  env: {
    VK_ICD_FILENAMES: path.join(destination, "vk_swiftshader_icd.json"),
    LD_LIBRARY_PATH: destination,
  },
};
await writeFile(
  path.join(destination, "aperture-runtime.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(JSON.stringify(manifest, null, 2));
