import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { defineApertureConfig } from "@aperture-engine/app";
import { mesh } from "@aperture-engine/app/systems";
import {
  createPolygonMeshAsset,
  decodeTypedArrayTree,
  validateMeshAsset,
} from "@aperture-engine/render";
import { createHeadlessSessionController } from "../../../packages/cli/dist/headless/session-controller.js";
import { preflightApertureSnapshotBundle } from "../../../packages/cli/dist/headless/bundle.js";
import CarScene from "../../../examples/procedural-car/src/systems/scene.system.ts";
import { fittedCarSurfaces } from "../../../examples/procedural-car/src/car.ts";
const output = process.argv[2];
assert(output, "Supply a temporary output bundle path");
assert.equal(typeof mesh.polygons, "function");
const session = await createHeadlessSessionController({
  config: defineApertureConfig({
    mode: "headless",
    render: { defaultCamera: false, defaultLight: false, sampleCount: 4 },
  }),
  systems: [{ default: CarScene }],
  seed: 42,
  assetMode: "strict",
  root: process.cwd(),
  publicDir: "public",
  allowHttpAssets: false,
  determinism: "off",
});
try {
  await session.createBundle({ out: output, digest: true });
  const bundle = JSON.parse(await readFile(output, "utf8"));
  assert.equal(preflightApertureSnapshotBundle(bundle).ok, true);
  assert.equal(bundle.assetProvenance.placeholderCount, 0);
  const assets = decodeTypedArrayTree(bundle.assets);
  const surfaces = fittedCarSurfaces();
  for (const [key, options] of [
    ["car.body.mesh", surfaces.body],
    ["car.glazing.mesh", surfaces.glazing],
  ]) {
    const entry = assets.entries.find(
      (entry) => entry.handle.kind === "mesh" && entry.handle.id === key,
    );
    assert(entry);
    assert.equal(validateMeshAsset(entry.asset).valid, true);
    const expected = createPolygonMeshAsset(options);
    assert.deepEqual(
      entry.asset.vertexStreams[0].data,
      expected.vertexStreams[0].data,
    );
    assert.deepEqual(entry.asset.indexBuffer.data, expected.indexBuffer.data);
  }
  console.log(
    JSON.stringify({
      verified: true,
      output,
      meshDraws: session.extract().snapshot.meshDraws.length,
      placeholders: 0,
      gpuVerified: false,
    }),
  );
} finally {
  await session.dispose();
}
