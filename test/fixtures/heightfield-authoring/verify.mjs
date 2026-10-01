import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import { mesh } from "@aperture-engine/app/systems";
import {
  createHeightfieldMeshAsset,
  decodeTypedArrayTree,
  HeightfieldMeshError,
} from "../../../packages/render/dist/index.js";
import { createHeadlessSessionController } from "../../../packages/cli/dist/headless/session-controller.js";
import { preflightApertureSnapshotBundle } from "../../../packages/cli/dist/headless/bundle.js";
import HeightfieldAuthoringScene, { terrain } from "./scene.ts";

// Ordinary Node consumes built package exports, with no Vitest aliases or GPU
// mocks. The emitted bundle is native Aperture geometry, not a pixel proof.
const root = fileURLToPath(new URL("../../../", import.meta.url));
const output = process.argv[2];
if (output === undefined)
  throw new Error(
    "Provide an output bundle path: node test/fixtures/heightfield-authoring/verify.mjs /tmp/heightfield.json",
  );
assert.equal(typeof mesh.heightfield, "function");
assert.throws(
  () => createHeightfieldMeshAsset({ heights: [[0], [0]] }),
  HeightfieldMeshError,
);
const config = defineApertureConfig({
  mode: "headless",
  render: {
    defaultCamera: false,
    defaultLight: false,
    bloom: { threshold: 0.8, intensity: 0.05, radiusPixels: 2 },
  },
});
const editedHeights = terrain.heights.map((row) => [...row]);
editedHeights[1][2] = 2.4;
const editedOptions = { ...terrain, heights: editedHeights };
const expected = createHeightfieldMeshAsset(editedOptions);

const app = await createApertureApp({
  config,
  systems: [{ default: HeightfieldAuthoringScene }],
});
let editedVersion;
try {
  const dynamic = app.context.meshes.dynamic("terrain.surface.mesh");
  assert.deepEqual(dynamic.get(), createHeightfieldMeshAsset(terrain));
  const before = app.extract();
  editedVersion = dynamic.publish(expected).version;
  const after = app.extract();
  assert.equal(editedVersion, 2);
  assert.equal(after.meshDraws.length, 1);
  assert.deepEqual(after.meshDraws[0].mesh, before.meshDraws[0].mesh);
  assert.equal(after.meshDraws[0].renderId, before.meshDraws[0].renderId);
  assert.equal(
    after.bounds[after.meshDraws[0].boundsIndex].localAabb.max[1],
    Math.fround(2.4),
  );
  assert.deepEqual(dynamic.get(), expected);
} finally {
  await app.dispose();
}

class EditedHeightfieldScene extends HeightfieldAuthoringScene {
  init() {
    super.init();
    // Publish on the existing handle; do not respawn the entity's stable key.
    this.meshes
      .dynamic("terrain.surface.mesh")
      .publish(createHeightfieldMeshAsset(editedOptions));
  }
}
const session = await createHeadlessSessionController({
  config,
  systems: [{ default: EditedHeightfieldScene }],
  seed: 42,
  assetMode: "strict",
  root,
  publicDir: "public",
  allowHttpAssets: false,
  determinism: "off",
});
try {
  async function capture() {
    await session.createBundle({ out: output, digest: true });
    const bundle = JSON.parse(await readFile(output, "utf8"));
    assert.equal(preflightApertureSnapshotBundle(bundle).ok, true);
    assert.equal(bundle.assetProvenance.placeholderCount, 0);
    const snapshot = session.extract().snapshot;
    assert.equal(snapshot.meshDraws.length, 1);
    const assets = decodeTypedArrayTree(bundle.assets);
    const entry = assets.entries.find(
      (entry) =>
        entry.handle.kind === "mesh" &&
        entry.handle.id === "terrain.surface.mesh",
    );
    assert.equal(entry.status, "ready");
    assert.deepEqual(entry.asset, expected);
    return {
      digest: bundle.digest.hash,
      meshDraws: snapshot.meshDraws.length,
      vertices: entry.asset.vertexStreams[0].vertexCount,
      triangles: entry.asset.vertexStreams[0].vertexCount / 3,
      assetCount: assets.entries.length,
      placeholders: bundle.assetProvenance.placeholderCount,
    };
  }
  const first = await capture();
  await session.reset({ seed: 42 });
  const reset = await capture();
  assert.deepEqual(reset, first);
  process.stdout.write(
    `${JSON.stringify({ verified: true, output: path.resolve(output), ...reset, editedVersion, gpuVerified: false })}\n`,
  );
} finally {
  session.dispose();
}
