import test from "node:test";
import assert from "node:assert/strict";
import { casterAsset, createFixture, MODES, STATES } from "./fixture.mjs";

const bytes = (value) =>
  Buffer.from(value.buffer, value.byteOffset, value.byteLength);
test("vertex and index changes are isolated; bounds and topology stay fixed", () => {
  const baseline = casterAsset(),
    vertices = casterAsset("vertices"),
    indices = casterAsset("indices");
  assert.notDeepEqual(
    bytes(baseline.vertexStreams[0].data),
    bytes(vertices.vertexStreams[0].data),
  );
  assert.deepEqual(
    bytes(baseline.indexBuffer.data),
    bytes(vertices.indexBuffer.data),
  );
  assert.deepEqual(
    bytes(baseline.vertexStreams[0].data),
    bytes(indices.vertexStreams[0].data),
  );
  assert.notDeepEqual(
    bytes(baseline.indexBuffer.data),
    bytes(indices.indexBuffer.data),
  );
  for (const asset of [vertices, indices]) {
    assert.deepEqual(asset.submeshes, baseline.submeshes);
    assert.deepEqual(asset.localAabb, baseline.localAabb);
    assert.deepEqual(asset.localSphere, baseline.localSphere);
    assert.equal(asset.vertexStreams[0].vertexCount, 48);
    assert.equal(asset.indexBuffer.data.length, 36);
  }
});
for (const mode of MODES)
  test(`${mode}: real ECS publications keep handle, identity, bounds and draw packets`, () => {
    const fixture = createFixture(mode),
      identity = fixture.identity();
    let previous = "baseline",
      first;
    for (const [index, state] of STATES.entries()) {
      if (state.shape !== previous) fixture.publish(state.shape);
      previous = state.shape;
      assert.equal(fixture.version(), state.version);
      assert.deepEqual(fixture.identity(), identity);
      const snapshot = fixture.snapshot(index + 1);
      assert.equal(snapshot.frame, index + 1);
      assert.equal(snapshot.shadowRequests.length, 1);
      assert.equal(
        snapshot.shadowRequests[0].lightKind,
        mode === "cascaded" ? "directional" : mode,
      );
      assert.equal(
        snapshot.shadowRequests[0].cascadeCount,
        mode === "cascaded" ? 2 : mode === "directional" ? 1 : undefined,
      );
      assert.equal(snapshot.shadowCasterDraws.length, 1);
      first ??= snapshot;
      assert.deepEqual(snapshot.shadowCasterDraws, first.shadowCasterDraws);
      assert.ok(snapshot.bounds.length > 0);
      assert.deepEqual(snapshot.bounds, first.bounds);
      assert.deepEqual(snapshot.transforms, first.transforms);
      assert.deepEqual(snapshot.viewMatrices, first.viewMatrices);
      const fresh = casterAsset(state.shape);
      assert.deepEqual(
        bytes(fixture.asset().vertexStreams[0].data),
        bytes(fresh.vertexStreams[0].data),
      );
      assert.deepEqual(
        bytes(fixture.asset().indexBuffer.data),
        bytes(fresh.indexBuffer.data),
      );
    }
  });

test("native materials use explicit dielectric factors and intended colors", () => {
  const fixture = createFixture("directional");
  const materials = fixture.materialHandles.map(
    (handle) => fixture.extraction.assets.get(handle).asset,
  );
  assert.deepEqual(
    materials.map((material) => material.metallicFactor),
    [0, 0],
  );
  assert.deepEqual(
    materials.map((material) => material.roughnessFactor),
    [1, 1],
  );
  assert.deepEqual(
    Array.from(materials[0].baseColorFactor),
    [0.55, 0.2, 0.06, 1].map(Math.fround),
  );
  assert.deepEqual(
    Array.from(materials[1].baseColorFactor),
    [0.55, 0.58, 0.62, 1].map(Math.fround),
  );
});
