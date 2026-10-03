/** Offline exact decoded-pixel and raw-geometry controls. No browser/server. */
import { readFile } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SCHEMA, SESSION_IDS, statesFor, COMPOSITIONS } from "./contract.mjs";
import { checkPins } from "./run.mjs";
import {
  sha256,
  inspectCanvasPng,
  writeImmutable,
} from "./harness/recorder.mjs";
import {
  canonical,
  requireValue,
  validateStateRecord,
  validateTransition,
} from "./harness/checks.mjs";
const directory = dirname(fileURLToPath(import.meta.url)),
  repo = resolve(directory, "../..");
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
export function exactGeometry(evidence) {
  return evidence.nativeGeometry.meshes.map((m) => ({
    name: m.name,
    positions: m.positions,
    indices: m.indices,
    worldMatrix: m.worldMatrix,
    streams: m.streams.map((s) => ({
      data: s.data,
      rawBytes: s.rawBytes,
      dataType: s.dataType,
      arrayType: s.arrayType,
      arrayStride: s.arrayStride,
      byteStride: s.byteStride,
      attributes: s.attributes,
      semantic: s.semantic,
    })),
    indexRaw: m.indexBuffer?.rawBytes ?? null,
    submeshes: m.submeshes ?? null,
    groups: m.groups ?? null,
    materials: m.materials ?? null,
  }));
}
export function difference(a, b) {
  requireValue(
    Buffer.isBuffer(a) &&
      Buffer.isBuffer(b) &&
      a.length === b.length &&
      a.length % 3 === 0,
    "RGB buffers differ in dimensions",
  );
  let differentPixels = 0,
    maximumChannelDifference = 0;
  for (let i = 0; i < a.length; i += 3) {
    const d = Math.max(
      Math.abs(a[i] - b[i]),
      Math.abs(a[i + 1] - b[i + 1]),
      Math.abs(a[i + 2] - b[i + 2]),
    );
    if (d) differentPixels++;
    maximumChannelDifference = Math.max(maximumChannelDifference, d);
  }
  return { differentPixels, maximumChannelDifference };
}
async function readAttempt(engine, session, attempt, pinSha) {
  const root = resolve(directory, "renders", engine, session, attempt),
    outcome = await readJson(resolve(root, "outcome.json")),
    runner = await readJson(resolve(root, "verified-runner.json")),
    summary = await readJson(resolve(root, "recorder-summary.json"));
  requireValue(
    outcome.status === "passed" &&
      outcome.sourcePinsUnchanged === true &&
      outcome.serverClosed === true &&
      outcome.sourcePinsSha256 === pinSha &&
      outcome.requestErrors.length === 0 &&
      runner.status === "passed" &&
      summary.complete,
    "Native attempt not passed/immutable/closed",
  );
  const states = statesFor(session),
    expected = states
      .flatMap((s) => [`states/${s.id}.json`, `states/${s.id}.png`])
      .concat("complete.json");
  requireValue(
    summary.acknowledged.length === expected.length &&
      summary.states === states.length,
    "Wrong native state inventory",
  );
  for (const [i, receipt] of summary.acknowledged.entries()) {
    requireValue(
      receipt.path === expected[i],
      "Wrong artifact receipt path/order",
    );
    const bytes = await readFile(resolve(root, receipt.path));
    requireValue(
      bytes.length === receipt.bytes && sha256(bytes) === receipt.sha256,
      "Artifact receipt bytes changed",
    );
  }
  const records = [],
    images = [];
  for (const state of states) {
    const record = await readJson(resolve(root, `states/${state.id}.json`));
    validateStateRecord(record, state.index, states);
    validateTransition(
      record.evidence,
      state,
      records.at(-1)?.evidence ?? null,
      engine,
    );
    records.push(record);
    images.push(
      inspectCanvasPng(
        await readFile(resolve(root, `states/${state.id}.png`)),
        { includePixels: true },
      ).rgb,
    );
  }
  return { root: relative(repo, root), records, images };
}
export async function compareAll(attempt = "attempt-001") {
  requireValue(
    /^attempt-[0-9]{3}$/.test(attempt),
    "Expected immutable attempt-NNN",
  );
  const frozen = await checkPins(),
    result = {
      schema: SCHEMA + ".comparison",
      attempt,
      sourcePinsSha256: frozen.sha256,
      engines: {},
      status: "passed",
    };
  for (const engine of ["aperture", "threejs"]) {
    const sessions = {};
    for (const session of SESSION_IDS)
      sessions[session] = await readAttempt(
        engine,
        session,
        attempt,
        frozen.sha256,
      );
    const live = sessions.live,
      checks = [];
    for (const [i, state] of statesFor().entries()) {
      const fresh = sessions[`fresh-${state.edit}`];
      const pixels = difference(live.images[i], fresh.images[0]),
        geometryEqual =
          canonical(exactGeometry(live.records[i].evidence)) ===
          canonical(exactGeometry(fresh.records[0].evidence));
      checks.push({
        state: state.id,
        control: `fresh-${state.edit}`,
        expectation: "exact RGB and raw geometry equality",
        ...pixels,
        geometryEqual,
        ok: pixels.differentPixels === 0 && geometryEqual,
      });
    }
    for (const edit of Object.keys(COMPOSITIONS).filter(
      (e) => e !== "baseline",
    )) {
      const pixels = difference(
        sessions["fresh-baseline"].images[0],
        sessions[`fresh-${edit}`].images[0],
      );
      checks.push({
        state: edit,
        control: "fresh-baseline",
        expectation: "visible mutation",
        ...pixels,
        ok: pixels.differentPixels > 0,
      });
    }
    const oldAttempt = engine === "aperture" ? "attempt-005" : "attempt-001",
      oldRoot = resolve(
        repo,
        "benchmarks/crane-live-edits-20261003/renders",
        engine,
        oldAttempt,
      );
    const oldOutcome = await readJson(resolve(oldRoot, "outcome.json"));
    requireValue(
      oldOutcome.status === "passed",
      "Old native baseline did not pass",
    );
    const baseline = inspectCanvasPng(
      await readFile(resolve(oldRoot, "states/s00-baseline.png")),
      { includePixels: true },
    ).rgb;
    const pixels = difference(sessions["fresh-baseline"].images[0], baseline);
    checks.push({
      state: "fresh-baseline",
      control: relative(repo, resolve(oldRoot, "states/s00-baseline.png")),
      expectation: "exact retained baseline RGB equality",
      ...pixels,
      ok: pixels.differentPixels === 0,
    });
    result.engines[engine] = {
      status: checks.every((c) => c.ok) ? "passed" : "failed",
      checks,
    };
    if (result.engines[engine].status === "failed") result.status = "failed";
  }
  result.scope =
    "Post-author composition regression; exact within-engine controls, never cross-engine pixel equality, performance or score.";
  return result;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [attempt, output, ...extra] = process.argv.slice(2);
  requireValue(
    extra.length === 0 && /^[a-z0-9-]+\.json$/.test(output ?? ""),
    "Expected attempt-NNN and new comparison JSON basename",
  );
  let result;
  try {
    result = await compareAll(attempt);
  } catch (error) {
    result = {
      schema: SCHEMA + ".comparison",
      status: "failed",
      attempt,
      error: error.stack ?? error.message,
    };
  }
  await writeImmutable(
    resolve(directory, output),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
  if (result.status !== "passed") process.exitCode = 1;
}
