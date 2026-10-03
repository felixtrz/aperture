import test from "node:test";
import assert from "node:assert/strict";
import { createApertureApp } from "../../packages/app/dist/advanced.js";
import { createFixture as componentFixture } from "../native-shadow-light-matrix-v2-20261003/fixture.mjs";
import { nativeEvidenceBytes } from "../crane-live-edits-20261003/author-a/post-author-byte-diagnostic/native-evidence.mjs";
import { createMatrixSystem } from "./scene-system.mjs";
import { CHANNEL, CONFIG, MODES, VARIANTS, statesFor } from "./contract.mjs";

const frozen = [
  "meshDraws",
  "shadowCasterDraws",
  "lights",
  "shadowRequests",
  "bounds",
  "transforms",
  "views",
  "viewMatrices",
];
for (const mode of MODES)
  for (const variant of VARIANTS) {
    test(`${mode}/${variant}: generated ECS matches component authoring exactly after empty bootstrap`, async () => {
      let owner;
      const app = await createApertureApp({
        config: CONFIG,
        worldOptions: { entityCapacity: 16 },
        systems: [
          {
            default: createMatrixSystem(mode, variant, (value) => {
              owner = value;
            }),
          },
        ],
      });
      try {
        const bootstrap = app.stepAndExtract(1 / 60, 0, 7);
        assert.equal(bootstrap.meshDraws.length, 0);
        assert.equal(bootstrap.shadowRequests.length, 0);
        assert.equal(owner.revision, 0);
        assert.equal(app.lowLevel.assets.list().length, 0);
        let priorIdentity;
        for (const [index, state] of statesFor(mode, variant).entries()) {
          app.context.commands.queue(CHANNEL, {
            id: state.id,
            index,
            revision: index + 1,
          });
          const snapshot = app.stepAndExtract(
            1 / 60,
            (index + 1) / 60,
            index + 8,
          );
          const evidence = owner.evidenceAtNativePublication(
            snapshot.frame,
            snapshot,
          );
          const reference = componentFixture(mode, state.shape),
            referenceSnapshot = reference.snapshot(index + 8);
          for (const key of frozen)
            assert.deepEqual(snapshot[key], referenceSnapshot[key], key);
          assert.equal(evidence.assetVersion, state.version);
          assert.equal(
            evidence.resources.meshAssetReplacements,
            state.version - 1,
          );
          assert.equal(
            evidence.resources.publishedVertexArrayReplacements,
            state.version - 1,
          );
          assert.equal(
            evidence.resources.publishedIndexArrayReplacements,
            state.version - 1,
          );
          assert.deepEqual(
            nativeEvidenceBytes(evidence.sourceMesh.streams[0]),
            new Uint8Array(reference.asset().vertexStreams[0].data.buffer),
          );
          assert.deepEqual(
            nativeEvidenceBytes(evidence.sourceMesh.indexBuffer),
            new Uint8Array(reference.asset().indexBuffer.data.buffer),
          );
          assert.equal(evidence.assetVersions.length, 4);
          priorIdentity ??= evidence.identity;
          assert.deepEqual(evidence.identity, priorIdentity);
          assert.equal(owner.originalWorld, app.lowLevel.world);
          assert.equal(owner.originalRegistry, app.lowLevel.assets);
        }
      } finally {
        await app.dispose();
      }
    });
  }
for (const requests of [
  [{ id: "baseline", index: 0, revision: 2 }],
  [{ id: "wrong", index: 0, revision: 1 }],
  [{ id: "noop", index: 1, revision: 2 }],
  [
    { id: "baseline", index: 0, revision: 1 },
    { id: "noop", index: 1, revision: 2 },
  ],
])
  test(`command guard rejects ${JSON.stringify(requests)}`, async () => {
    const app = await createApertureApp({
      config: CONFIG,
      systems: [{ default: createMatrixSystem("directional", "live") }],
    });
    try {
      for (const request of requests)
        app.context.commands.queue(CHANNEL, request);
      assert.throws(() => app.stepAndExtract(1 / 60, 1 / 60, 1));
      assert.equal(app.lowLevel.assets.list().length, 0);
    } finally {
      await app.dispose();
    }
  });
