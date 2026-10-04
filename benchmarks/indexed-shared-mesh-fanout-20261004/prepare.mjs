/** Produce write-once review artifacts. Never freezes/adopts or launches native work. */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { collectPins, here, repo, sha256 } from "./inputs.mjs";
import * as contract from "./contract.mjs";
import { sceneModule } from "./cpu-loader.mjs";
const [cpuLog, moduleReport, prefix] = process.argv.slice(2);
assert(/^cpu-\d{3}\.log$/.test(cpuLog ?? ""));
assert(/^preflight-\d{3}\.json$/.test(moduleReport ?? ""));
assert(/^prepared-\d{3}$/.test(prefix ?? ""));
const save = (suffix, value) =>
  writeFile(
    resolve(here, `${prefix}-${suffix}.json`),
    JSON.stringify(value, null, 2) + "\n",
    { flag: "wx" },
  );
const text = await readFile(resolve(here, cpuLog), "utf8"),
  line = text
    .split("\n")
    .find((l) => l.startsWith("INDEXED_FANOUT_CPU_SUMMARY ")),
  tests = Number(text.match(/ℹ tests (\d+)/)?.[1]),
  passed = Number(text.match(/ℹ pass (\d+)/)?.[1]);
assert(
  line && text.includes("ℹ fail 0") && tests === passed && tests > 0,
  "Complete passing CPU log required",
);
const cpu = {
  ...JSON.parse(line.slice("INDEXED_FANOUT_CPU_SUMMARY ".length)),
  tests,
  passed,
  log: cpuLog,
  logSha256: sha256(text),
  focusedSuiteOnly: true,
};
const modules = JSON.parse(await readFile(resolve(here, moduleReport)));
assert.equal(modules.status, "passed");
assert.equal(modules.browsersLaunched, 0);
assert.equal(modules.serversStarted, 0);
const pins = await collectPins();
for (const module of Object.values(modules.modules))
  assert.equal(
    pins.files[module.name]?.sha256,
    module.inputSha256,
    "Module preflight is stale: " + module.name,
  );
const derivation = JSON.parse(
  await readFile(resolve(here, "derivation-start.json")),
);
for (const file of derivation.files) {
  const original = await readFile(resolve(repo, file.source)),
    actual = await readFile(resolve(repo, file.destination));
  assert.equal(sha256(original), file.sourceSha256, "Retained source changed");
  file.preparedSha256 = sha256(actual);
  file.unchanged = original.equals(actual);
  if (
    [
      "native-observer.mjs",
      "indirect-evidence.mjs",
      "indirect.test.mjs",
      "observer.test.mjs",
      "author-a/legacy-scene.mjs",
    ].some((name) => file.destination.endsWith("/" + name))
  )
    assert(
      file.unchanged,
      "Retained observer/argument boundary or geometric source changed",
    );
}
const { CONFIG, CAMERAS, PALETTE } = (await sceneModule()).module;
await save("cpu", cpu);
await save("inputs", pins);
await save("derivation", derivation);
await save("contract", {
  schema: contract.SCHEMA,
  stage: "prepared-unfrozen",
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
  indexing: {
    representation:
      "identity Uint16 over exact omitted-normal triangle corners",
    deduplication: false,
    vertexStreamsChanged: false,
    boundsChanged: false,
    sharedMainMethod: "drawIndexedIndirect",
    slotBytes: 20,
    firstInstances: [0, 3, 6],
    baseVertex: 0,
    pipePartOrder: ["inner", "outer", "rims"],
    nonindexedSentinels: ["courtyard.slab", "prop.crate.body"],
  },
});
const artifacts = {};
for (const name of [
  cpuLog,
  moduleReport,
  "derivation-start.json",
  ...["cpu", "inputs", "derivation", "contract"].map(
    (s) => `${prefix}-${s}.json`,
  ),
]) {
  const bytes = await readFile(resolve(here, name));
  artifacts[name] = { bytes: bytes.length, sha256: sha256(bytes) };
}
await save("report", {
  status: "ready-for-independent-source-review",
  preparedInputFiles: Object.keys(pins.files).length,
  verifiedRetainedEngineSourceFiles: pins.engineSourceVerified.length,
  browserModules: modules.moduleCount,
  cpuTests: tests,
  cpuPassed: passed,
  artifacts,
  nativeSessions: 0,
  nativeCaptures: 0,
  browsersLaunched: 0,
  serversStarted: 0,
  gates: {
    independentSourceReview: "unrun",
    immutableNativeFreeze: "unrun",
    nativeSessions: "unrun (7 planned)",
    nativeCaptures: "unrun (14 planned)",
    exactNativeRgbControls: "unrun (11 planned)",
    independentNativeAudit: "unrun",
    formalAuthorTranscriptsAndIdentity: "unavailable/unclaimed",
    formalBlindScoringAndCrossEngineComparison: "unrun/unclaimed",
    performanceOrMemoryMeasurement: "unrun/unclaimed",
    fullRepositoryCheck: "unrun; focused CPU suite only",
  },
  boundary:
    "CPU mocks validate observation logic and installed algorithms; not GPU readback or native indexed activation",
  priorNativeResults:
    "Retained V2/audit are historical nonindexed evidence only; no lost indexed logs reconstructed",
  next: "Independent source review, reconcile any findings, then parent may publish and separately freeze/admit native work",
});
console.log(
  JSON.stringify({
    status: "prepared-unfrozen",
    prefix,
    tests,
    modules: modules.moduleCount,
    inputFiles: Object.keys(pins.files).length,
    browsersLaunched: 0,
    serversStarted: 0,
  }),
);
