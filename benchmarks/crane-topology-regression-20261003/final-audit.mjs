/** Final actual-byte provenance after runtime-only runner pin additions. */
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { here, repo } from "./cpu-loader.mjs";
import { resolve } from "node:path";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex"),
  checkpoint = "df4b5b249d8966bb4f74b734a6b3f6fc3abd3786",
  entries = [];
for (const entry of JSON.parse(await readFile(resolve(here, "derivation.json")))
  .files) {
  const src = await readFile(resolve(repo, entry.source)),
    dst = await readFile(resolve(repo, entry.destination)),
    committed = execFileSync("git", ["show", `${checkpoint}:${entry.source}`], {
      cwd: repo,
      maxBuffer: 16 * 1024 * 1024,
    });
  if (
    !src.equals(committed) ||
    hash(src) !== entry.sourceSha256 ||
    hash(dst) !== entry.derivedSha256
  )
    throw Error("Final provenance changed: " + entry.source);
  entries.push({ ...entry, checkpointBytesEqual: true });
}
const report = {
  status: "passed",
  checkpoint,
  localHeadUsed: false,
  entries,
  supersedes:
    "source-audit.json is the retained preliminary receipt before exact runtime-root/link checks were added; this receipt describes the final derivation.",
};
await writeFile(
  resolve(here, "source-audit-final.json"),
  JSON.stringify(report, null, 2) + "\n",
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    status: "passed",
    finalDerivedFiles: entries.length,
    checkpoint,
  }),
);
