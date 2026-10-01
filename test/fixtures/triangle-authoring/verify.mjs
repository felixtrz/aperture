import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { asset, defineApertureConfig } from "@aperture-engine/app/config";
import { mesh } from "@aperture-engine/app/systems";
import {
  createTriangleListMeshAsset,
  decodeTypedArrayTree,
  TriangleListMeshError,
} from "../../../packages/render/dist/index.js";
import { createHeadlessSessionController } from "../../../packages/cli/dist/headless/session-controller.js";
import { preflightApertureSnapshotBundle } from "../../../packages/cli/dist/headless/bundle.js";
import TriangleAuthoringScene, { ramp, roof } from "./scene.ts";

// An ordinary Node process consumes built packages. No Vitest src aliases or
// browser mocks take part in the facade, factory, extraction or bundle paths.
const root = fileURLToPath(new URL("../../../", import.meta.url));
const output = process.argv[2];
if (output === undefined) {
  throw new Error(
    "Provide an output bundle path: node test/fixtures/triangle-authoring/verify.mjs /tmp/triangle-authoring.json",
  );
}
assert.equal(typeof mesh.triangleList, "function");
assert.throws(
  () => createTriangleListMeshAsset({ positions: [] }),
  TriangleListMeshError,
);

const session = await createHeadlessSessionController({
  config: defineApertureConfig({
    mode: "headless",
    render: {
      defaultCamera: false,
      defaultLight: false,
      defaultEnvironment: false,
    },
    assets: { model: asset.gltf("/assets/cube.glb", { preload: "blocking" }) },
  }),
  systems: [{ default: TriangleAuthoringScene }],
  seed: 42,
  assetMode: "strict",
  root: path.join(root, "examples/developer-api"),
  publicDir: "public",
  allowHttpAssets: false,
  determinism: "off",
});
try {
  async function capture() {
    assert.equal(session.callTool({ name: "camera_create_agent" }).ok, true);
    assert.equal(
      session.callTool({
        name: "camera_frame_entities",
        arguments: { subjects: [{ key: "triangle.assembly" }] },
      }).ok,
      true,
    );
    await session.createBundle({ out: output, digest: true });
    const bundle = JSON.parse(await readFile(output, "utf8"));
    assert.equal(preflightApertureSnapshotBundle(bundle).ok, true);
    assert.equal(bundle.assetProvenance.placeholderCount, 0);
    const snapshot = session.extract().snapshot;
    assert.equal(snapshot.meshDraws.length, 3);
    const assets = decodeTypedArrayTree(bundle.assets);
    for (const [name, options] of [
      ["roof", roof],
      ["ramp", ramp],
    ]) {
      const entry = assets.entries.find(
        (entry) =>
          entry.handle.kind === "mesh" &&
          entry.handle.id === `triangle.${name}.mesh`,
      );
      assert.equal(entry.status, "ready");
      assert.deepEqual(entry.asset, createTriangleListMeshAsset(options));
    }
    return {
      digest: bundle.digest.hash,
      meshDraws: snapshot.meshDraws.length,
      bounds: snapshot.bounds.length,
      assetCount: assets.entries.length,
      placeholders: bundle.assetProvenance.placeholderCount,
    };
  }
  const first = await capture();
  await session.reset({ seed: 42 });
  const reset = await capture();
  assert.deepEqual(reset, first);
  process.stdout.write(
    `${JSON.stringify({ verified: true, output: path.resolve(output), ...reset, flatRoofVertices: 24, indexedRampVertices: 4, indexedRampIndices: 6, gpuVerified: false })}\n`,
  );
} finally {
  session.dispose();
}
