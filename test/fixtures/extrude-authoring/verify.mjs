import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import { mesh } from "@aperture-engine/app/systems";
import {
  createExtrudeMeshAsset,
  decodeTypedArrayTree,
  ExtrudeMeshError,
} from "../../../packages/render/dist/index.js";
import { createHeadlessSessionController } from "../../../packages/cli/dist/headless/session-controller.js";
import { preflightApertureSnapshotBundle } from "../../../packages/cli/dist/headless/bundle.js";
import ExtrudeAuthoringScene, { facade } from "./scene.ts";

// Ordinary Node consumes built package exports, with no Vitest aliases or GPU
// mocks. The emitted bundle is native Aperture geometry, not a pixel proof.
const root = fileURLToPath(new URL("../../../", import.meta.url));
const output = process.argv[2];
if (output === undefined)
  throw new Error(
    "Provide an output bundle path: node test/fixtures/extrude-authoring/verify.mjs /tmp/extrude.json",
  );
assert.equal(typeof mesh.extrude, "function");
assert.throws(
  () => createExtrudeMeshAsset({ outline: [], depth: 1 }),
  ExtrudeMeshError,
);
const config = defineApertureConfig({
  mode: "headless",
  render: {
    defaultCamera: false,
    defaultLight: false,
    bloom: { threshold: 0.8, intensity: 0.05, radiusPixels: 2 },
  },
});
const editedOptions = {
  ...facade,
  depth: 0.8,
};
const expected = createExtrudeMeshAsset(editedOptions);

const app = await createApertureApp({
  config,
  systems: [{ default: ExtrudeAuthoringScene }],
});
let editedVersion;
try {
  const dynamic = app.context.meshes.dynamic("facade.mesh");
  assert.deepEqual(dynamic.get(), createExtrudeMeshAsset(facade));
  const before = app.extract();
  editedVersion = dynamic.publish(expected).version;
  const after = app.extract();
  assert.equal(editedVersion, 2);
  assert.equal(after.meshDraws.length, 2);
  assert.deepEqual(after.meshDraws[0].mesh, before.meshDraws[0].mesh);
  assert.equal(after.meshDraws[0].renderId, before.meshDraws[0].renderId);
  const facadeDraw = after.meshDraws.find(
    (draw) => draw.mesh.id === "facade.mesh",
  );
  assert.equal(
    after.bounds[facadeDraw.boundsIndex].localAabb.max[2],
    Math.fround(0.8),
  );
  assert.deepEqual(dynamic.get(), expected);
} finally {
  await app.dispose();
}

class EditedExtrudeScene extends ExtrudeAuthoringScene {
  init() {
    super.init();
    // Publish on the existing handle; do not respawn the entity's stable key.
    this.meshes
      .dynamic("facade.mesh")
      .publish(createExtrudeMeshAsset(editedOptions));
  }
}
const session = await createHeadlessSessionController({
  config,
  systems: [{ default: EditedExtrudeScene }],
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
    assert.equal(snapshot.meshDraws.length, 2);
    const assets = decodeTypedArrayTree(bundle.assets);
    const entry = assets.entries.find(
      (entry) =>
        entry.handle.kind === "mesh" && entry.handle.id === "facade.mesh",
    );
    assert.equal(entry.status, "ready");
    assert.deepEqual(entry.asset, expected);
    return {
      digest: bundle.digest.hash,
      meshDraws: snapshot.meshDraws.length,
      vertices: entry.asset.vertexStreams[0].vertexCount,
      triangles: entry.asset.indexBuffer.data.length / 3,
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
