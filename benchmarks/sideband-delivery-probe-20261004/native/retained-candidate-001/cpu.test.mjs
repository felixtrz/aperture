/** Native preparation: real compiled CPU producer plus explicitly synthetic verifier controls. No browser/server. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { here, repo, checkPins, sha256 } from "./inputs.mjs";
import { SESSIONS, statesFor, SCHEMA } from "./contract.mjs";
import { readServedModule } from "./routes.mjs";
import { loadProducer } from "./cpu-loader.mjs";
import { validateState } from "./checks.mjs";
import { validateNativePermit, canonical } from "./permit.mjs";
import { comparePixels } from "./compare.mjs";
import { compactNativeScope } from "../../indexed-shared-mesh-fanout-20261004/native-observer.mjs";
const load = (name) => import(pathToFileURL(resolve(repo, name)).href);
const { createSharedSnapshotTransport } = await load(
  "packages/runtime/dist/index.js",
);
const { AssetRegistry } = await load("packages/simulation/dist/index.js");
const { mirrorSourceAssetRegistryFromMessage } = await load(
  "packages/app/dist/asset-mirror.js",
);
const {
  producer: { createProducer },
} = await loadProducer();
const summary = {
  kind: "CPU preparation only; native GPU runs unexecuted",
  browsersLaunched: 0,
  serversStarted: 0,
  realProducer: [],
  rejectedMutations: [],
};

test("exact three-session six-capture scope", () => {
  assert.deepEqual(SESSIONS, ["before-poll", "late-delivery", "cold-changed"]);
  assert.equal(
    SESSIONS.reduce((n, session) => n + statesFor(session).length, 0),
    6,
  );
  assert.throws(() => statesFor("extra"));
});

test("actual compiled extraction, source serialization and SAB path preserve one snapshot then sideband delivery", () => {
  for (const session of SESSIONS) {
    const shared = createSharedSnapshotTransport({
      maxEntities: 8,
      maxViews: 2,
      maxPacketWords: 2048,
      requireCrossOriginIsolated: false,
    });
    const outgoing = [],
      mirror = new AssetRegistry();
    const producer = createProducer(
      {
        postMessage(message) {
          outgoing.push(structuredClone(message));
          mirrorSourceAssetRegistryFromMessage(mirror, message);
        },
      },
      { transport: shared, probeSession: session },
    );
    let requestId = 0;
    const command = (operation, options = {}) =>
      producer.command({
        type: "sideband.probe.command",
        requestId: ++requestId,
        operation,
        ...options,
      });
    command("publish", { frame: session === "cold-changed" ? 2 : 1 });
    command("notify", { kind: "snapshot" });
    const first = producer.state();
    assert.equal(mirror.get(first.mesh).version, 1);
    assert.equal(shared.reader.readLatestFrame().frame, first.frame);
    assert.equal(shared.reader.readLatestFrame().transforms.length, 16);
    if (session !== "cold-changed") {
      command("publish", { frame: 2, change: true });
      assert.equal(mirror.get(first.mesh).version, 1);
      assert.equal(shared.reader.readLatestFrame().frame, 2);
      command("notify", { kind: "sourceAssets" });
      assert.equal(mirror.get(first.mesh).version, 2);
      const sideband = outgoing.find(
        (message) => message.type === "aperture.simulation.sourceAssets",
      );
      assert.equal(sideband.frame, 2);
      assert.equal(sideband.sourceAssets.entries.length, 1);
      assert.equal(sideband.snapshot, undefined);
      assert.equal(sideband.transport, undefined);
      if (session === "late-delivery") command("publish", { frame: 3 });
    }
    const final = producer.state();
    const array = mirror.get(final.mesh).asset.vertexStreams[0].data;
    const bytes = [
      ...new Uint8Array(array.buffer, array.byteOffset, array.byteLength),
    ];
    assert.deepEqual(bytes, final.expected.changed.vertices[0].bytes);
    assert.notDeepEqual(bytes, final.expected.baseline.vertices[0].bytes);
    const snapshotCount = outgoing.filter(
      (message) => message.type === "aperture.simulation.snapshot",
    ).length;
    assert.equal(snapshotCount, 1);
    assert.throws(() => command("publish", { frame: final.frame }));
    assert.throws(() => command("publish", { frame: 4 }));
    summary.realProducer.push({
      session,
      finalFrame: final.frame,
      sourceVersion: final.sourceVersion,
      mirrorVersion: mirror.get(final.mesh).version,
      snapshotCount,
      changedBytes: bytes.length,
    });
  }
});

function syntheticRecord() {
  const transport = createSharedSnapshotTransport({
    maxEntities: 8,
    maxViews: 2,
    maxPacketWords: 2048,
    requireCrossOriginIsolated: false,
  });
  const producer = createProducer({ postMessage() {} }, { transport });
  const state = producer.state(),
    asset = state.expected.baseline;
  const upload = (id, bytes) => ({
    id,
    submissionSerial: 1,
    contentVersion: 1,
    writeCalls: 1,
    allocationBytes: bytes.length,
    fullUploadBytes: [...bytes],
    writtenRanges: [[0, bytes.length]],
    uncertainRanges: [],
    destroyed: false,
  });
  const draw = {
    method: "drawIndexed",
    count: 36,
    instances: 1,
    start: 0,
    baseVertex: 0,
    firstInstance: 0,
    submittedFrame: 1,
    submissionSerial: 1,
    commandBufferId: 10,
    commandEncoderId: 11,
    vertices: [
      { id: 1, slot: 0, offset: 0, size: asset.vertices[0].bytes.length },
    ],
    index: {
      id: 2,
      offset: 0,
      size: asset.index.bytes.length,
      format: asset.index.format,
    },
    uploads: [upload(1, asset.vertices[0].bytes), upload(2, asset.index.bytes)],
    pipeline: { id: 3, vertex: { code: "worldTransforms" }, targets: [{}] },
    pass: { colors: [{}], depth: {} },
  };
  return {
    schema: SCHEMA,
    session: "before-poll",
    id: "baseline",
    expected: statesFor("before-poll")[0],
    frame: 1,
    mirrorVersion: 1,
    sourceAtRender: state,
    mirroredAsset: structuredClone(asset),
    snapshot: { frame: 1, meshDraws: [{ mesh: state.mesh }] },
    report: { ok: true, frame: 1 },
    snapshotNotifications: 1,
    messages: [{ type: "aperture.simulation.snapshot", frame: 1 }],
    native: compactNativeScope({
      frame: 1,
      draws: [draw],
      commands: [{ id: 10, encoderId: 11, submissionSerial: 1 }],
      submissions: 1,
      shadowHistory: [],
    }),
    proof: {
      native: true,
      adapters: [{ architecture: "swiftshader" }],
      devices: [{ adapter: { architecture: "swiftshader" } }],
      canvasWebGPU: 1,
      webglAttempts: 0,
      submissions: 1,
      draws: 1,
      errors: [],
      deviceLost: [],
    },
    capture: {
      width: 1024,
      height: 1024,
      gpuFenceCompleted: true,
      presentationFrames: 2,
    },
  };
}

test("synthetic acceptance validator rejects corrupted native joins, frame/asset bytes and notification evidence", () => {
  const original = syntheticRecord();
  validateState(original, "before-poll", "baseline");
  const changes = {
    frame: (r) => r.frame++,
    mirrorVersion: (r) => r.mirrorVersion++,
    extraSnapshot: (r) => r.snapshotNotifications++,
    sourceBytes: (r) => (r.mirroredAsset.vertices[0].bytes[0] ^= 255),
    uploadBytes: (r) =>
      (r.native.bufferSnapshots["1:1"].fullUploadBytes[0] ^= 255),
    uninitialized: (r) => (r.native.bufferSnapshots["1:1"].writtenRanges = []),
    uncertain: (r) =>
      (r.native.bufferSnapshots["1:1"].uncertainRanges = [[0, 1]]),
    staleSubmission: (r) => r.native.commands[0].submissionSerial++,
    drawCount: (r) => r.native.draws[0].count--,
    fakeMethod: (r) => (r.native.draws[0].method = "draw"),
    wrongFormat: (r) => (r.native.draws[0].index.format = "uint32"),
    missingUpload: (r) => delete r.native.bufferSnapshots["1:1"],
    webgl: (r) => r.proof.webglAttempts++,
    nativeMissing: (r) => (r.proof.native = false),
    unfenced: (r) => (r.capture.gpuFenceCompleted = false),
  };
  for (const [name, change] of Object.entries(changes)) {
    const record = structuredClone(original);
    change(record);
    assert.throws(() => validateState(record, "before-poll", "baseline"), name);
    summary.rejectedMutations.push(name);
  }
});

test("synthetic exact-pixel controls reject both missing visible change and unequal cold image", () => {
  const baseline = Buffer.alloc(1024 * 3, 20),
    changed = Buffer.alloc(1024 * 3, 200);
  const map = () =>
    new Map([
      ["before-poll/baseline", baseline],
      ["late-delivery/baseline", baseline],
      ["late-delivery/early", baseline],
      ["before-poll/changed", changed],
      ["late-delivery/converged", changed],
      ["cold-changed/changed", changed],
    ]);
  assert.equal(comparePixels(map()).changedPixels, 1024);
  const wrong = map();
  wrong.set("cold-changed/changed", baseline);
  assert.throws(() => comparePixels(wrong));
  assert.throws(() =>
    comparePixels(new Map([...map()].map(([key]) => [key, baseline]))),
  );
});

test("native guard rejects preparation permit, wrong source pins, session, attempt and boot", async () => {
  const args = {
    session: "before-poll",
    attempt: "attempt-001",
    pinsSha256: "a".repeat(64),
    boot: "test-boot",
  };
  const spec = {
    session: args.session,
    attempt: args.attempt,
    fixturePinsSha256: args.pinsSha256,
    nativeExecution: true,
    browserRoute: "runVerifiedScene",
    writeDomain:
      "benchmarks/sideband-delivery-probe-20261004/native/renders/before-poll",
  };
  const begin = {
    dispatch_authorized: true,
    kind: "write",
    operation: "run-sideband-native-before-poll",
    task: "/root/probe_sideband_delivery",
    incarnation:
      "local:34528b6b55687ab3ae8060c82485d7bbd4d9aba5d33690bf933d4225eb448916",
    local_execution: { boot_id: args.boot },
    payload: sha256(
      Buffer.from(JSON.stringify(canonical(spec), null, 2) + "\n"),
    ),
  };
  validateNativePermit(begin, spec, args);
  const currentPreparation = JSON.parse(
    await readFile(resolve(here, "preparation-inputs.json"), "utf8"),
  ).permit;
  assert.throws(() => validateNativePermit(currentPreparation, spec, args));
  for (const key of ["session", "attempt", "pinsSha256", "boot"])
    assert.throws(() =>
      validateNativePermit(begin, spec, { ...args, [key]: "wrong" }),
    );
});

test("all served browser/worker import bodies resolve to pinned exact bytes without a server", async () => {
  const freeze = await checkPins();
  const pending = ["/main.mjs", "/worker.mjs"],
    seen = new Set();
  while (pending.length) {
    const route = pending.pop();
    if (seen.has(route)) continue;
    seen.add(route);
    const module = await readServedModule(route, "before-poll", freeze.pins);
    for (const imported of ts.preProcessFile(
      module.body.toString("utf8"),
      true,
      true,
    ).importedFiles) {
      const specifier = imported.fileName;
      assert(
        specifier.startsWith("/") || specifier.startsWith("."),
        `Unmapped browser bare import ${specifier} from ${route}`,
      );
      const next = new URL(specifier, "http://127.0.0.1" + route).pathname;
      if (/\.(mjs|js)$/.test(next)) pending.push(next);
    }
  }
  assert(seen.size > 500);
  summary.pinnedServedModuleClosure = seen.size;
  for (const session of SESSIONS) {
    const module = await readServedModule("/session.mjs", session, freeze.pins);
    assert(module.body.toString().includes(JSON.stringify(session)));
  }
  await assert.rejects(() =>
    readServedModule("/../outside", "before-poll", freeze.pins),
  );
  await assert.rejects(() =>
    readServedModule("/arbitrary.mjs", "before-poll", freeze.pins),
  );
});
test.after(() => console.log("PREPARATION_SUMMARY " + JSON.stringify(summary)));
