/** CPU-only immutable V2 metadata, mechanically derived from byte-exact V1. */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import * as contract from "./contract.mjs";
import { sceneModule } from "./cpu-loader.mjs";
import {
  verifyPreservedArchives,
  repo,
  sha256,
} from "./archive-verification.mjs";
const here = dirname(fileURLToPath(import.meta.url)),
  prior = resolve(repo, "benchmarks/shared-mesh-fanout-20261003"),
  archives = await verifyPreservedArchives(),
  sourceCommit = "d0868fbae24d6cd70794d9c4914249ed634df303";
const save = (name, v) =>
  writeFile(resolve(here, name), JSON.stringify(v, null, 2) + "\n", {
    flag: "wx",
  });
await save("PRESERVATION.json", archives);
const allowedChanges = new Set([
    "contract.mjs",
    "run.mjs",
    "native-observer.mjs",
    "fanout-checks.mjs",
    "cpu.test.mjs",
    "parent-native-command.mjs",
    "prepare.mjs",
    "freeze.mjs",
    "final-audit.mjs",
  ]),
  files = [];
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "renders") await visit(path);
      continue;
    }
    if (!/\.(mjs|py|html)$/.test(entry.name)) continue;
    const name = relative(prior, path),
      source = relative(repo, path),
      destination = relative(repo, resolve(here, name)),
      a = await readFile(path),
      b = await readFile(resolve(here, name)),
      sourceBlob = execFileSync("git", ["show", `${sourceCommit}:${source}`], {
        cwd: repo,
        maxBuffer: 16 * 1024 * 1024,
      });
    assert(a.equals(sourceBlob), "V1 source commit differs: " + source);
    if (!allowedChanges.has(name))
      assert(a.equals(b), "Unrelated V1 fixture changed: " + name);
    files.push({
      source,
      destination,
      sourceSha256: sha256(a),
      derivedSha256: sha256(b),
      unchanged: a.equals(b),
    });
  }
}
await visit(prior);
await save("derivation.json", {
  predecessorSourceCommit: sourceCommit,
  predecessorFailureArchiveCommit: archives.v1.commit,
  correction:
    "Indirect-draw evidence only; namespace and preparation metadata updated",
  allowedChangedInheritedFiles: [...allowedChanges],
  files,
});
const { CONFIG, CAMERAS, PALETTE } = (await sceneModule()).module,
  frozen = {
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
  },
  original = JSON.parse(await readFile(resolve(prior, "frozen-contract.json")));
assert.deepEqual(frozen, { ...original, schema: contract.SCHEMA });
await save("frozen-contract.json", frozen);
const log = process.argv[2];
if (!/^cpu-[0-9]{3}\.log$/.test(log ?? ""))
  throw Error("Passing CPU log required");
const text = await readFile(resolve(here, log), "utf8"),
  line = text.split("\n").find((l) => l.startsWith("FANOUT_CPU_SUMMARY "));
if (!line || !text.includes("ℹ fail 0")) throw Error("Passing CPU log missing");
await save("CPU_REPORT.json", {
  ...JSON.parse(line.slice("FANOUT_CPU_SUMMARY ".length)),
  tests: Number(text.match(/ℹ tests (\d+)/)?.[1]),
  passed: Number(text.match(/ℹ pass (\d+)/)?.[1]),
  log,
  logSha256: sha256(Buffer.from(text)),
  focusedSuiteOnly: true,
});
const inherited = JSON.parse(
    await readFile(resolve(prior, "source-pins.json")),
  ),
  traceFiles = {};
const v1Failure = JSON.parse(
    await readFile(
      resolve(prior, "renders/aperture/live/attempt-001/failure.json"),
    ),
  ),
  v1Evidence = v1Failure.partialState.evidence,
  v1Report = v1Evidence.nativeSubmission.nativeFrameReport,
  v1PipeDraws = v1Evidence.nativeGeometry.submittedDraws.draws.filter((d) =>
    d.vertices.some((v) => v.label.startsWith("pipe.hollow-elbow.")),
  );
assert.equal(v1PipeDraws.length, 3);
assert(
  v1PipeDraws.every(
    (d) => d.method === "drawIndirect" && d.unsupportedIndirect && !d.indirect,
  ),
);
for (const name of [
  "app/frame-loop",
  "app/queued-built-in-frame",
  "app/frame-boundary-support",
  "app/frame-boundaries",
  "render/frame/frame-boundary",
  "render/draw/indirect-draw-commands",
  "render/draw/render-bundle",
  "render/passes/render-pass-command-executor",
  "gpu/initialize-webgpu",
])
  for (const [folder, ext] of [
    ["src", "ts"],
    ["dist", "js"],
  ]) {
    const path = `packages/webgpu/${folder}/${name}.${ext}`,
      bytes = await readFile(resolve(repo, path)),
      pin = inherited.files[path];
    assert(
      pin && pin.sha256 === sha256(bytes) && pin.bytes === bytes.length,
      "Unpinned route file: " + path,
    );
    traceFiles[path] = pin;
  }
await save("SOURCE_TRACE.json", {
  scope:
    "Read-only source and installed compiled route inspection plus CPU conversion/executor tests",
  engineSourceCommit: contract.ENGINE_SOURCE,
  route: [
    "Unchanged standard-material scene, worker and renderer.renderSnapshot call use the installed frame loop",
    "frame-loop selects queued built-in route when multiUnlit is null and the first built-in material is supported or multiple resource sets exist",
    "queued-built-in-frame merges real commands then calls prepareWebGpuAppIndirectDrawCommands before boundary assembly",
    "frame-boundary-support forwards real commands and cache with adapter indirect-first-instance support; no fixture option forces the draw route",
    "indirect-draw-commands chooses instanceCount >= 2, creates INDIRECT|COPY_DST, uploads CPU arguments into 20-byte slots, and retains buffer plus offset",
    "frame-boundary uses render-bundle execution where eligible; both bundle and direct executor call native drawIndirect/drawIndexedIndirect with actual buffer and offset",
    "initialize-webgpu requests indirect-first-instance when supported; V2 independently records actual device feature for nonzero firstInstance",
  ],
  v1Observed:
    "Three pipe drawIndirect calls; V1 did not preserve their buffer/offset/argument bytes. Argument values and genuine coalescing remain unverified.",
  v1RouteObservation: {
    frame: v1Report.frame,
    materialQueue: v1Report.diagnosticsSummary.materialQueue,
    resolvedDraws: v1Report.diagnosticsSummary.renderFrameQueue.draw,
    indirectRendererReport: v1Report.indirectDraws,
    observedPipeCalls: v1PipeDraws.map((d) => ({
      method: d.method,
      viaBundle: d.viaBundle === true,
      labels: d.vertices.map((v) => v.label),
    })),
    limitation:
      "Renderer diagnostics are supporting route metadata, not retained GPUBuffer identities or indirect argument bytes",
  },
  formats: {
    drawIndirect: [
      "u32 vertexCount",
      "u32 instanceCount",
      "u32 firstVertex",
      "u32 firstInstance",
    ],
    drawIndexedIndirect: [
      "u32 indexCount",
      "u32 instanceCount",
      "u32 firstIndex",
      "i32 baseVertex",
      "u32 firstInstance",
    ],
  },
  installedCompiledProvenance: inherited.compiledProvenance,
  files: traceFiles,
});
const commands = {};
for (const session of contract.SESSION_IDS)
  commands[session] = execFileSync(
    process.execPath,
    [resolve(here, "parent-native-command.mjs"), session],
    { cwd: repo },
  )
    .toString()
    .trim();
await save("PARENT_NATIVE_COMMANDS.json", {
  nativeAdmission:
    "Each command requires separate parent admission; not executed by preparation",
  nativeWrapperSha256: inherited.nativeWrapperSha256,
  cleanupHelperSha256: inherited.helperSha256,
  root: "/workspace/scratch/0190a8c72f8a/aperture-tmp",
  commands,
  entrypoint: "run.mjs -> scripts/verified-webgpu.mjs runVerifiedScene",
  sessions: 7,
  captures: 14,
});
console.log(
  JSON.stringify({
    status: "prepared",
    v1FilesExact: archives.v1.filesExact,
    v1BytesExact: archives.v1.totalBytes,
    topologyFilesExact: archives.topology.filesExact,
    derivations: files.length,
    settingsByteEquivalentExceptSchema: true,
    browsers: 0,
  }),
);
