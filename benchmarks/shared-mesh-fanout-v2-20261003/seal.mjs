/** CPU-only final preparation inventory; self-log and sealing lifecycle are explicitly external to its manifest. */
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { checkPins } from "./run.mjs";
import { sha256 } from "./archive-verification.mjs";
const here = dirname(fileURLToPath(import.meta.url)),
  freeze = await checkPins();
const readJson = async (name) =>
  JSON.parse(await readFile(resolve(here, name)));
const save = (name, value) =>
  writeFile(resolve(here, name), JSON.stringify(value, null, 2) + "\n", {
    flag: "wx",
  });
const cpuLog = await readFile(resolve(here, "cpu-frozen-001.log"), "utf8"),
  preflight = await readJson("preflight-frozen-001.json"),
  audit = await readJson("final-audit-001.json");
if (
  !cpuLog.includes("ℹ fail 0") ||
  preflight.status !== "passed" ||
  audit.status !== "passed" ||
  audit.sourcePinsSha256 !== freeze.sha256
)
  throw Error("Missing frozen passing results");
const lifecycle = [];
for (const name of await readdir(resolve(here, "lifecycle-audits"))) {
  const data = await readFile(resolve(here, "lifecycle-audits", name)),
    events = data
      .toString()
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line)),
    start = events.find((e) => e.event === "run-start"),
    end = events.find((e) => e.event === "run-completed");
  if (!start || !end || start.run !== end.run)
    throw Error("Nonterminal owned lifecycle: " + name);
  lifecycle.push({
    audit: "lifecycle-audits/" + name,
    sha256: sha256(data),
    run: end.run,
    job: start.job,
    exitcode: end.exitcode,
    terminalEvent: end.event,
  });
}
await save("QUIESCENCE.json", {
  status:
    "All prior owned preparation jobs completed; final sealing wrapper terminal event required",
  scope: "This worker's V2 preparation only; no claim about other workers",
  priorActiveOwnedLifecycleJobs: 0,
  ownedLifecycleRuns: lifecycle,
  sealingRun: process.env.APERTURE_TMP_RUN_ID,
  sealingAuditDirectory: "lifecycle-audits-seal",
  sealingCompletion:
    "Check run-completed exitcode 0 after this script and its adopted cleanup wrapper return",
  browsers: 0,
  nativeAttempts: 0,
  builds: 0,
  installs: 0,
  publications: 0,
  descendantWorkers: 0,
});
await save("PREPARATION_REPORT.json", {
  status: "V2 CPU fixture frozen; all native sessions unrun",
  sourcePinsSha256: freeze.sha256,
  focusedFrozenTests: {
    log: "cpu-frozen-001.log",
    logSha256: sha256(Buffer.from(cpuLog)),
    passed: Number(cpuLog.match(/ℹ pass (\d+)/)?.[1]),
    failed: 0,
    focusedSuiteOnly: true,
  },
  frozenPreflight: {
    report: "preflight-frozen-001.json",
    modules: preflight.moduleCount,
    browserLaunches: preflight.browsersLaunched,
    servers: preflight.serversStarted,
  },
  finalAudit: audit,
  nativeCommands: "PARENT_NATIVE_COMMANDS.json",
  remainingNativeSessions: 7,
  remainingCaptures: 14,
  failedPreparationLogs: [
    "preparation-failure-001.log",
    "preparation-failure-002.log",
    "prepare-001.log",
  ],
  limitations: [
    "No V2 native GPU coalescing or pixels observed",
    "V1 missing indirect argument bytes were never reconstructed",
    "CPU and synthetic observer tests are not GPU proof",
    "Compiled bytes retain inherited pins without new build/reproduction",
    "Original author transcript/model gates missing",
    "No performance/memory, cross-engine, score, merge or release claim",
  ],
  quiescence:
    "QUIESCENCE.json; sealing terminal lifecycle event must also be checked",
});
const files = {},
  excluded = [
    "MANIFEST.json",
    "SHA256SUMS",
    "seal-001.log",
    "lifecycle-audits-seal/",
  ];
async function visit(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const p = resolve(path, entry.name),
      name = relative(here, p);
    if (entry.isSymbolicLink()) throw Error("Unexpected fixture symlink");
    if (entry.isDirectory()) {
      if (name !== "lifecycle-audits-seal") await visit(p);
    } else if (!excluded.includes(name)) {
      const b = await readFile(p);
      files[name] = { bytes: b.length, sha256: sha256(b) };
    }
  }
}
await visit(here);
const manifest = {
  schema: "aperture.shared-mesh-fanout.preparation-manifest.v2",
  sourcePinsSha256: freeze.sha256,
  nativeUnrun: true,
  exclusions: excluded,
  exclusionReason:
    "Self-referential outputs and currently running seal log/lifecycle; preserve and inspect their terminal event separately",
  files: Object.fromEntries(
    Object.entries(files).sort(([a], [b]) => a.localeCompare(b)),
  ),
};
await save("MANIFEST.json", manifest);
const manifestBytes = await readFile(resolve(here, "MANIFEST.json"));
await writeFile(
  resolve(here, "SHA256SUMS"),
  [
    ...Object.entries(manifest.files).map(
      ([name, pin]) => `${pin.sha256}  ${name}`,
    ),
    `${sha256(manifestBytes)}  MANIFEST.json`,
  ].join("\n") + "\n",
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    status: "sealed",
    sourcePinsSha256: freeze.sha256,
    manifestSha256: sha256(manifestBytes),
    manifestFiles: Object.keys(files).length,
    priorLifecycleJobs: lifecycle.length,
    sealingRun: process.env.APERTURE_TMP_RUN_ID,
    sha256sumsSha256: sha256(await readFile(resolve(here, "SHA256SUMS"))),
  }),
);
