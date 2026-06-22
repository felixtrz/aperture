import { bench, describe } from "vitest";
import { mat4 } from "wgpu-matrix";
import type { Mat4 } from "@aperture-engine/simulation";
import {
  createPackedSnapshotTransformsScratch,
  createSnapshotPacketRegistry,
  encodeSnapshotPackets,
  extractRenderSnapshot,
  packSnapshotTransforms,
  writePackedSnapshotTransforms,
  planRenderWorldDrawPackages,
  type RenderWorldDrawReadinessReport,
  type RenderWorldReadyDraw,
} from "@aperture-engine/render";
import {
  createFrustumPlanes,
  isVisibleInAnyMatchingView,
  type ViewCullContext,
} from "../../packages/render/src/rendering/extraction-culling.js";
import { buildExtractionScene } from "./fixtures/extraction-scene.js";

// AI-76: multi-scale render-pipeline micro-benchmarks over the production
// extraction path (mirrors Bevy's extract_render_asset bench scales). Run with
// `pnpm run bench`; the CI-enforced budget assertions live in
// test/rendering/extraction-budget.test.ts.
const SCALES = [10, 100, 1_000, 10_000];

for (const entityCount of SCALES) {
  describe(`render pipeline @ ${entityCount} entities`, () => {
    const { world, assets } = buildExtractionScene(entityCount);
    const snapshot = extractRenderSnapshot(world, assets, { frame: 1 });
    const packed = packSnapshotTransforms(snapshot);
    const readiness: RenderWorldDrawReadinessReport = {
      ready: snapshot.meshDraws.map(
        (packet): RenderWorldReadyDraw => ({
          renderId: packet.renderId,
          packet,
          meshResourceKey: `mesh-resource:${packet.mesh.id}`,
          materialResourceKey: `material-resource:${packet.material.id}`,
          batchKey: packet.batchKey,
        }),
      ),
      blocked: [],
      diagnostics: [],
    };
    const registry = createSnapshotPacketRegistry();
    const projection = mat4.perspective(Math.PI / 2, 1, 0.1, 1_000);
    const view = mat4.translation([0, 0, -50]);
    const planes = createFrustumPlanes(
      mat4.multiply(projection, view) as unknown as Mat4,
    );
    const cullContext: ViewCullContext = {
      viewId: 1,
      camera: { index: 0, generation: 0 },
      priority: 0,
      layerMask: 1,
      viewMatrix: mat4.identity() as unknown as Mat4,
      frustumCulling: true,
      planes,
      stats: {
        viewId: 1,
        camera: { index: 0, generation: 0 },
        tested: 0,
        culled: 0,
        included: 0,
      },
    };
    const worldAabbs = snapshot.bounds.map((bounds) => bounds.worldAabb);

    bench("extractRenderSnapshot", () => {
      extractRenderSnapshot(world, assets, { frame: 1 });
    });

    bench("packSnapshotTransforms", () => {
      packSnapshotTransforms(snapshot);
    });

    // AI-64: the per-frame steady-state cost — a persistent scratch sees an
    // unchanged snapshot, so packing degenerates to one O(n) compare with no
    // copy and (downstream) no GPU upload.
    const persistentScratch = createPackedSnapshotTransformsScratch();
    writePackedSnapshotTransforms(snapshot, persistentScratch);
    bench("writePackedSnapshotTransforms (static frame)", () => {
      writePackedSnapshotTransforms(snapshot, persistentScratch);
    });

    bench("frustum cull world AABBs", () => {
      for (const aabb of worldAabbs) {
        isVisibleInAnyMatchingView(aabb, 1, [cullContext]);
      }
    });

    bench("planRenderWorldDrawPackages", () => {
      planRenderWorldDrawPackages(readiness, packed);
    });

    bench("encodeSnapshotPackets", () => {
      encodeSnapshotPackets(snapshot, { registry });
    });
  });
}
