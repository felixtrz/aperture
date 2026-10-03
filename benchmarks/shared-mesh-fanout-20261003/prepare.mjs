/** Preparation metadata, immutable per basename; call before freeze, not after admission. */
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import * as contract from "./contract.mjs";
import { sceneModule } from "./cpu-loader.mjs";
const here = dirname(fileURLToPath(import.meta.url)),
  repo = resolve(here, "../.."),
  prior = "benchmarks/crane-topology-regression-20261003",
  hash = (b) => createHash("sha256").update(b).digest("hex");
const mapping = [
  "contract.mjs",
  "run.mjs",
  "preflight.mjs",
  "author-a/main.mjs",
  "author-a/worker.mjs",
  "author-a/native-evidence.mjs",
  "author-a/frame-proof.mjs",
  "author-a/index.html",
  "harness/contract.mjs",
  "harness/base-checks.mjs",
  "harness/client.mjs",
  "harness/recorder.mjs",
  "topology.mjs",
].map((path) => [path, path]);
mapping.push(["author-a/scene.mjs", "author-a/legacy-scene.mjs"]);
const files = [];
for (const [source, destination] of mapping) {
  const a = await readFile(resolve(repo, prior, source)),
    b = await readFile(resolve(here, destination));
  files.push({
    source: prior + "/" + source,
    destination: relative(repo, resolve(here, destination)),
    sourceSha256: hash(a),
    derivedSha256: hash(b),
    unchanged: a.equals(b),
  });
}
const save = (name, v) =>
  writeFile(resolve(here, name), JSON.stringify(v, null, 2) + "\n", {
    flag: "wx",
  });
await save("derivation.json", {
  predecessorSourceCommit: "7c4b867ac432bfbb132c58066b809c530e785032",
  files,
});
const { CONFIG, CAMERAS, PALETTE } = (await sceneModule()).module;
await save("frozen-contract.json", {
  schema: contract.SCHEMA,
  parameters: contract.PARAMETERS,
  topologies: contract.TOPOLOGIES,
  sessions: Object.fromEntries(
    contract.SESSION_IDS.map((s) => [s, contract.statesFor(s)]),
  ),
  budgets: contract.BUDGETS,
  workerSettings: contract.WORKER_SETTINGS,
  transforms: contract.INSTANCE_TRANSLATIONS,
  view: contract.VIEW,
  light: contract.LIGHT,
  appearance: { CONFIG, CAMERAS, PALETTE },
  semantics: contract.SEMANTICS,
});
const log = process.argv[2];
if (!/^cpu-[0-9]{3}\.log$/.test(log ?? ""))
  throw Error("Exact passing CPU log required");
const text = await readFile(resolve(here, log), "utf8"),
  line = text.split("\n").find((l) => l.startsWith("FANOUT_CPU_SUMMARY "));
if (!line || !text.includes("ℹ fail 0")) throw Error("Passing CPU log missing");
const report = JSON.parse(line.slice("FANOUT_CPU_SUMMARY ".length));
await save("CPU_REPORT.json", {
  ...report,
  log,
  logSha256: hash(Buffer.from(text)),
  focusedSuiteOnly: true,
});
console.log(
  JSON.stringify({
    status: "prepared",
    derivations: files.length,
    cpuLog: log,
  }),
);
