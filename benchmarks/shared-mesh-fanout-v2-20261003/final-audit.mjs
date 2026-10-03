/** CPU-only recheck of source pins and the unchanged V1 failure/successful topology archives. */
import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkPins } from "./run.mjs";
import { verifyPreservedArchives } from "./archive-verification.mjs";
const here = dirname(fileURLToPath(import.meta.url)),
  freeze = await checkPins(),
  archives = await verifyPreservedArchives();
const output = process.argv[2];
if (!/^final-audit-[0-9]{3}\.json$/.test(output ?? ""))
  throw Error("New audit basename required");
const report = {
  status: "passed",
  sourcePinsSha256: freeze.sha256,
  pinnedFiles: Object.keys(freeze.pins.files).length,
  runtimeSymlinks: Object.keys(freeze.pins.runtimeSymlinks).length,
  preservedArchives: Object.fromEntries(
    Object.entries(archives).map(([name, a]) => [
      name,
      {
        commit: a.commit,
        filesExact: a.filesExact,
        totalBytes: a.totalBytes,
        ...(a.publication ? { publication: a.publication } : {}),
      },
    ]),
  ),
  browserSessions: 0,
  builds: 0,
  installs: 0,
  publications: 0,
  descendants: 0,
  scope:
    "Only V2 fixture written; native and coalescing remain unverified pending separate admission",
};
await writeFile(resolve(here, output), JSON.stringify(report, null, 2) + "\n", {
  flag: "wx",
});
console.log(JSON.stringify(report));
