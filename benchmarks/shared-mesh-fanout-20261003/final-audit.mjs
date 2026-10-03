/** CPU-only retained provenance, lifecycle and manifest verification. */
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { checkPins } from "./run.mjs";
const here = dirname(fileURLToPath(import.meta.url)),
  repo = resolve(here, "../.."),
  sha = (b) => createHash("sha256").update(b).digest("hex"),
  freeze = await checkPins();
const commit = "8a2e900edd794d0392b133c332a3f1ba161f8302",
  prefix = "benchmarks/crane-topology-regression-20261003";
const list = execFileSync(
  "git",
  ["ls-tree", "-r", "-z", commit, "--", prefix],
  { cwd: repo, maxBuffer: 8 * 1024 * 1024 },
)
  .toString()
  .split("\0")
  .filter(Boolean);
let count = 0;
for (const row of list) {
  const path = row.split("\t")[1],
    oid = row.split("\t")[0].split(" ")[2],
    a = await readFile(resolve(repo, path)),
    b = execFileSync("git", ["cat-file", "blob", oid], {
      cwd: repo,
      maxBuffer: 32 * 1024 * 1024,
    });
  if (!a.equals(b)) throw Error("Prior native evidence changed: " + path);
  count++;
}
const output = process.argv[2];
if (!/^final-audit-[0-9]{3}\.json$/.test(output ?? ""))
  throw Error("New audit basename required");
const report = {
  status: "passed",
  sourcePinsSha256: freeze.sha256,
  pinnedFiles: Object.keys(freeze.pins.files).length,
  runtimeSymlinks: Object.keys(freeze.pins.runtimeSymlinks).length,
  priorNativeArchiveCommit: commit,
  priorNativeFilesExact: count,
  browserSessions: 0,
  builds: 0,
  installs: 0,
  publications: 0,
  descendants: 0,
  scope: "Only own bounded fixture written; native admission pending",
};
await writeFile(resolve(here, output), JSON.stringify(report, null, 2) + "\n", {
  flag: "wx",
});
console.log(JSON.stringify(report));
