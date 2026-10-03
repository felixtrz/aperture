/** Synthetic recorder inputs test gates, never genuine GPU proof. */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { SCHEMA, statesFor } from "./contract.mjs";
import { sceneModule } from "./cpu-loader.mjs";
import {
  createRecorder,
  crc32,
  inspectCanvasPng,
  readBoundedBody,
} from "./harness/recorder.mjs";
import { selection, sessionContract, resolveModule } from "./run.mjs";
import { difference } from "./compare.mjs";
import { Readable } from "node:stream";
const { module } = await sceneModule("threejs");
const json = (value) =>
  JSON.parse(
    JSON.stringify(value, (_k, v) =>
      ArrayBuffer.isView(v) ? Array.from(v) : v,
    ),
  );
const asBytes = (value) => Buffer.from(JSON.stringify(value));
const raw = (array) =>
  Array.from(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
const proof = (n) => ({
  native: true,
  adapters: [{ description: "SwiftShader synthetic unit fixture" }],
  devices: [{ adapter: { description: "SwiftShader synthetic unit fixture" } }],
  canvasWebGPU: 1,
  webglAttempts: 0,
  submissions: n,
  draws: n,
  errors: [],
  deviceLost: [],
});
function record(state) {
  const source = module.buildScene(state.edit),
    meshes = source.meshes.map((m) => ({
      ...json(m),
      worldMatrix: [...m.matrix],
      streams: [
        ["position", "positions"],
        ["normal", "normals"],
        ["index", "indices"],
      ].map(([semantic, key]) => ({
        semantic,
        data: Array.from(m[key]),
        rawBytes: raw(m[key]),
        byteLength: m[key].byteLength,
        arrayType: m[key].constructor.name,
      })),
    }));
  const evidence = {
    stateId: state.id,
    revision: state.index + 1,
    parameters: source.parameters,
    camera: { position: [8, 6.5, 10], target: [0, 1.4, 0], verticalSpan: 10.5 },
    appearance: { syntheticUnitFixture: true },
    identity: {
      sceneId: "synthetic-unit-scene",
      entityCount: 63,
      meshCount: 63,
      meshes: meshes.map((m, i) => ({ name: m.name, entityId: i, meshId: i })),
    },
    resources: {
      nativeObjects: {
        geometriesCreated: 63,
        geometryReplacements: 0,
        geometryDisposeCalls: 0,
        attributesCreated: 189,
        attributeReplacements: 0,
        inPlaceAttributeWrites: 0,
        matrixUpdates: 0,
        meshesCreated: 63,
      },
    },
    sourceGeometry: {
      ...json(source),
      meshes: source.meshes.map((m) => ({
        ...json(m),
        rawStreams: ["positions", "normals", "indices"].map((semantic) => ({
          semantic,
          rawBytes: raw(m[semantic]),
        })),
      })),
    },
    nativeGeometry: { meshes },
    nativeChecks: {
      ok: true,
      checks: [{ name: "Synthetic CPU test, never WebGPU evidence", ok: true }],
    },
  };
  const pipe=meshes.find(m=>m.name==='pipe.hollow-elbow');
  for(const m of meshes){m.drawRange={start:0,count:null};m.geometryId=m.name;m.attributeIds={position:m.name+':p',normal:m.name+':n',index:m.name+':i'};}
  evidence.resources.inventory=[{mesh:pipe.name,semantic:'position',nativeDrawBufferId:1},{mesh:pipe.name,semantic:'index',nativeDrawBufferId:2}];
  evidence.nativeGeometry.submittedDraws={frame:state.index+1,submissions:1,draws:pipe.groups.map(g=>({method:'drawIndexed',count:g.count,start:g.start,instances:1,baseVertex:0,vertices:[{id:1,offset:0,size:pipe.positions.length*4,allocationBytes:pipe.positions.length*4}],index:{id:2,format:'uint32',offset:0,size:pipe.indices.length*4,allocationBytes:pipe.indices.length*4}}))};
  return {
    schema: SCHEMA,
    engine: "threejs",
    state,
    evidence,
    receipt: {
      stateId: state.id,
      revision: state.index + 1,
      workerRevision: state.index + 1,
      submittedRevision: state.index + 1,
      nativeFrame: state.index + 1,
      details: { syntheticUnitFixture: true },
    },
    proof: proof(state.index + 1),
    observations: {
      workerCount: 1,
      workerTerminationCalls: 0,
      deviceCount: 1,
      webgpuCanvasCount: 1,
      runtimeReferencesStable: true,
    },
    sanity: {
      stableIdentities: true,
      frozenCamera: true,
      frozenAppearance: true,
      resetGeometryEquivalent: true,
    },
    capture: {
      method: "HTMLCanvasElement.toBlob(image/png)",
      width: 1024,
      height: 1024,
      gpuFenceCompleted: true,
      presentationFrames: 2,
    },
  };
}
function chunk(name, data) {
  const type = Buffer.from(name),
    result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length);
  type.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([type, data])), data.length + 8);
  return result;
}
function png(alpha = 255, blank = false) {
  const stride = 4096,
    raw = Buffer.alloc(1024 * (stride + 1));
  for (let y = 0; y < 1024; y++)
    for (let x = 0; x < 1024; x++) {
      const offset = y * (stride + 1) + 1 + x * 4;
      raw[offset] = blank ? 64 : x % 2 ? 200 : 40;
      raw[offset + 1] = 80;
      raw[offset + 2] = 100;
      raw[offset + 3] = alpha;
    }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1024);
  header.writeUInt32BE(1024, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
async function fixture(run, states = statesFor("fresh-baseline")) {
  assert(process.env.APERTURE_TMP_RUN, "Adopted lifecycle is required");
  const root = await mkdtemp(
    resolve(process.env.APERTURE_TMP_RUN, "combined-recorder-"),
  );
  let passed = false;
  try {
    const result = await run(
      await createRecorder(root, { engine: "threejs", states }),
      root,
    );
    passed = true;
    return result;
  } finally {
    if (passed) await rm(root, { recursive: true });
  }
}
const image = png();
test("exact session selection and route resolution fail closed", () => {
  assert.equal(selection("aperture", "live", "attempt-001").length, 8);
  assert.equal(selection("threejs", "fresh-grow", "attempt-001").length, 1);
  for (const args of [
    ["wrong", "live", "attempt-001"],
    ["aperture", "other", "attempt-001"],
    ["threejs", "live", "old"],
  ])
    assert.throws(() => selection(...args));
  assert.equal(
    sessionContract("export const SESSION_ID = 'live';", "fresh-grow"),
    'export const SESSION_ID = "fresh-grow";',
  );
  assert.throws(() => sessionContract("", "live"), /seam/);
  assert.throws(() => resolveModule("/author-a/../contract.mjs"), /Forbidden/);
  assert.equal(resolveModule("/etc/passwd"), null);
  assert.equal(resolveModule("/node_modules/anything"), null);
  assert(
    resolveModule("/worker-modules/packages/app/dist/browser.js").endsWith(
      "packages/app/dist/browser.js",
    ),
  );
});
test("decoded PNG pixels reject blank, transparent, translucent, corrupt and mismatched data", () => {
  const one = inspectCanvasPng(image, { includePixels: true });
  assert.equal(one.rgb.length, 1024 * 1024 * 3);
  assert.equal(difference(one.rgb, one.rgb).differentPixels, 0);
  const two = Buffer.from(one.rgb);
  two[0] ^= 1;
  assert.equal(difference(one.rgb, two).differentPixels, 1);
  assert.throws(() => difference(one.rgb, two.subarray(3)));
  for (const bad of [png(0), png(128), png(255, true)])
    assert.throws(() => inspectCanvasPng(bad));
  const corrupt = Buffer.from(image);
  corrupt[100] ^= 1;
  assert.throws(() => inspectCanvasPng(corrupt));
});
test("fresh session complete manifest requires exact hashes and retains immutable artifacts", () =>
  fixture(async (recorder, root) => {
    const state = statesFor("fresh-baseline")[0],
      receipts = [];
    receipts.push(
      await recorder.record(
        `states/${state.id}.json`,
        asBytes(record(state)),
        "application/json",
      ),
    );
    receipts.push(
      await recorder.record(`states/${state.id}.png`, image, "image/png"),
    );
    await recorder.record(
      "complete.json",
      asBytes({
        schema: SCHEMA,
        engine: "threejs",
        states: 1,
        artifacts: receipts,
        proof: proof(1),
      }),
      "application/json",
    );
    assert.equal(recorder.summary().complete, true);
    assert.equal(recorder.summary().states, 1);
    await assert.rejects(
      () =>
        recorder.record(
          `states/${state.id}.json`,
          asBytes(record(state)),
          "application/json",
        ),
      /already acknowledged/,
    );
    assert.deepEqual(
      await readFile(resolve(root, `states/${state.id}.png`)),
      image,
    );
  }));
test("record ordering, no-op gate and synthetic native corruption are independently rejected", async () => {
  await fixture(
    async (r) => {
      await assert.rejects(
        () =>
          r.record(
            `states/${statesFor()[1].id}.json`,
            asBytes(record(statesFor()[1])),
            "application/json",
          ),
        /sequence/,
      );
    },
    statesFor().slice(0, 2),
  );
  await fixture(
    async (r) => {
      const states = statesFor().slice(0, 2);
      await r.record(
        `states/${states[0].id}.json`,
        asBytes(record(states[0])),
        "application/json",
      );
      await r.record(`states/${states[0].id}.png`, image, "image/png");
      const bad = record(states[1]);
      bad.evidence.resources.nativeObjects.inPlaceAttributeWrites = 1;
      await assert.rejects(
        () =>
          r.record(
            `states/${states[1].id}.json`,
            asBytes(bad),
            "application/json",
          ),
        /No-op|Wrong observed replacement delta/,
      );
    },
    statesFor().slice(0, 2),
  );
  await fixture(async (r) => {
    const state = statesFor("fresh-baseline")[0],
      bad = record(state);
    bad.evidence.nativeGeometry.meshes[0].streams[0].rawBytes[0] ^= 1;
    await assert.rejects(
      () =>
        r.record(`states/${state.id}.json`, asBytes(bad), "application/json"),
      /bytes differ/,
    );
  });
  await fixture(async (r) => {
    await assert.rejects(
      () =>
        r.record(
          "complete.json",
          asBytes({
            schema: SCHEMA,
            engine: "threejs",
            states: 1,
            artifacts: [],
            proof: proof(1),
          }),
          "application/json",
        ),
      /Incomplete/,
    );
  });
});
test("bounded body rejects oversized inputs", async () => {
  await assert.rejects(
    () => readBoundedBody(Readable.from([Buffer.alloc(16)]), 8),
    /bounded limit/,
  );
});
