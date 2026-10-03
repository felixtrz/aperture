/** CPU-only exclusive provenance/contract receipts before the one-time freeze. */
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as contract from "./contract.mjs";
import { sceneModule } from "./cpu-loader.mjs";
const directory = dirname(fileURLToPath(import.meta.url)),
  repo = resolve(directory, "../..");
const checkpoint = "df4b5b249d8966bb4f74b734a6b3f6fc3abd3786",
  hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const derivation = JSON.parse(
    await readFile(resolve(directory, "derivation.json"), "utf8"),
  ),
  entries = [];
for (const entry of derivation.files) {
  const original = await readFile(resolve(repo, entry.source)),
    derived = await readFile(resolve(repo, entry.destination));
  const checkpointBytes = execFileSync(
    "git",
    ["show", `${checkpoint}:${entry.source}`],
    { cwd: repo, maxBuffer: 16 * 1024 * 1024 },
  );
  if (
    !original.equals(checkpointBytes) ||
    hash(original) !== entry.sourceSha256 ||
    hash(derived) !== entry.derivedSha256
  )
    throw Error("Original or derived source changed: " + entry.source);
  entries.push({
    source: entry.source,
    sha256: entry.sourceSha256,
    bytes: original.length,
    checkpointBytesEqual: true,
    destination: entry.destination,
    derivedSha256: entry.derivedSha256,
  });
}
await writeFile(
  resolve(directory, "source-audit.json"),
  JSON.stringify(
    { status: "passed", checkpoint, localHeadUsed: false, entries },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
);
const a = (await sceneModule("aperture")).module,
  b = (await sceneModule("threejs")).module;
const value = {
  schema: contract.SCHEMA + ".contract",
  parameters: contract.PARAMETERS,
  topologies: contract.TOPOLOGIES,
  semantics: contract.SEMANTICS,
  budgets: contract.BUDGETS,
  sessions: Object.fromEntries(
    contract.SESSION_IDS.map((s) => [s, contract.statesFor(s)]),
  ),
  view: contract.VIEW,
  workerSettings: contract.WORKER_SETTINGS,
  originalSettings: {
    aperture: { config: a.CONFIG, cameras: a.CAMERAS, palette: a.PALETTE },
    threejs: {
      cameras: b.CAMERAS,
      palette: b.PALETTE,
      rendererAndLighting:
        "Frozen original renderer/lighting expressions; only worker deadline differs, as shown in derivation.diff",
    },
  },
};
await writeFile(
  resolve(directory, "frozen-contract.json"),
  JSON.stringify(value, null, 2) + "\n",
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    status: "passed",
    originalFilesVerifiedAgainstCheckpoint: entries.length,
    contractWritten: true,
  }),
);
