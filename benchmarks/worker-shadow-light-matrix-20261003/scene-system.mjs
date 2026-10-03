import {
  createSystem,
  WorldTransform,
} from "../../packages/app/dist/systems.js";
import { createSimulationApp } from "../../packages/runtime/dist/index.js";
import { populateFixture, casterAsset } from "./fixture.mjs";
import { CHANNEL, LABEL, statesFor } from "./contract.mjs";
import { nativeMeshEvidence } from "../crane-live-edits-20261003/author-a/post-author-byte-diagnostic/native-evidence.mjs";

// A fresh class/owner per app also permits isolated real-ECS CPU tests.
export function createMatrixSystem(mode, variant, onOwner = () => {}) {
  const states = statesFor(mode, variant);
  return class MatrixScene extends createSystem({ priority: 0 }) {
    init() {
      this.originalWorld = this.world;
      this.originalRegistry = this.assetsRegistry;
      this.sceneId = crypto.randomUUID();
      this.world.globals.matrixSceneId = this.sceneId;
      this.revision = 0;
      this.stateId = null;
      this.fixture = null;
      this.replacementCounters = {
        meshAssetReplacements: 0,
        publishedVertexArrayReplacements: 0,
        publishedIndexArrayReplacements: 0,
      };
      onOwner(this);
    }
    update() {
      const requests = this.commands.drain(CHANNEL);
      if (requests.length > 1)
        throw Error("Concurrent matrix commands rejected");
      if (!requests.length) return;
      const request = requests[0],
        state = states[request.index];
      if (
        !state ||
        request.id !== state.id ||
        request.revision !== request.index + 1 ||
        request.revision !== this.revision + 1
      )
        throw Error("Matrix command state/revision mismatch");
      // Generated demand startup may publish empty bootstrap frames. Author the
      // five exact entities only on the first command, so baseline caches are cold.
      if (!this.fixture) {
        if (
          this.world.entityVersionTrackingSize() !== 0 ||
          this.assetsRegistry.list().length !== 0
        )
          throw Error("Bootstrap unexpectedly authored entities/assets");
        // Public authoring facade sharing the EXISTING generated world/registry.
        // Its step/extraction is never used; generated app owns both boundaries.
        const authoring = createSimulationApp({
          world: this.world,
          assets: this.assetsRegistry,
        });
        this.fixture = populateFixture(authoring, mode, state.shape);
        this.originalCaster = this.fixture.caster;
        this.previousShape = state.shape;
      } else if (state.shape !== this.previousShape) {
        const before = this.fixture.asset(),
          asset = casterAsset(state.shape);
        const result = this.meshes.publish(this.fixture.mesh, asset);
        if (
          result.handle.id !== this.fixture.mesh.id ||
          this.meshes.get(this.fixture.mesh) !== asset
        )
          throw Error("Same-handle native publication failed");
        this.replacementCounters.meshAssetReplacements++;
        this.replacementCounters.publishedVertexArrayReplacements +=
          asset.vertexStreams.filter(
            (stream, i) => stream.data !== before.vertexStreams[i]?.data,
          ).length;
        this.replacementCounters.publishedIndexArrayReplacements += Number(
          asset.indexBuffer.data !== before.indexBuffer.data,
        );
      }
      this.previousShape = state.shape;
      if (this.fixture.version() !== state.version)
        throw Error("Native source asset version mismatch");
      this.revision = request.revision;
      this.stateId = state.id;
    }
    evidenceAtNativePublication(frame, snapshot) {
      if (
        !this.fixture ||
        this.world !== this.originalWorld ||
        this.assetsRegistry !== this.originalRegistry ||
        this.fixture.caster !== this.originalCaster ||
        this.world.globals.matrixSceneId !== this.sceneId
      )
        throw Error("Persistent worker authority changed");
      const worldMatrix = ["col0", "col1", "col2", "col3"].flatMap((key) =>
        Array.from(this.fixture.caster.getVectorView(WorldTransform, key)),
      );
      const identity = { ...this.fixture.identity(), sceneId: this.sceneId };
      return {
        stateId: this.stateId,
        revision: this.revision,
        snapshotFrame: frame,
        snapshotFrameField: snapshot.frame,
        mode,
        variant,
        identity,
        assetVersion: this.fixture.version(),
        resources: { ...this.replacementCounters },
        sourceMesh: nativeMeshEvidence(
          LABEL,
          this.fixture.asset(),
          worldMatrix,
          {
            entityId: identity.entityId,
            meshId: identity.meshId,
            assetVersion: this.fixture.version(),
          },
        ),
        assetVersions: this.assetsRegistry
          .list()
          .map(({ handle, version, status }) => ({ handle, version, status })),
      };
    }
  };
}
