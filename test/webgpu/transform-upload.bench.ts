import { bench, describe } from "vitest";
import {
  extractRenderSnapshot,
  packSnapshotTransforms,
} from "@aperture-engine/render";
import {
  createWorldTransformBufferDescriptorScratch,
  writeWorldTransformBufferDescriptor,
} from "@aperture-engine/webgpu";
import { buildExtractionScene } from "../rendering/fixtures/extraction-scene.js";

// AI-76: host-side cost of the per-frame transform upload path — descriptor
// planning plus the byte copy a queue.writeBuffer performs. Run with
// `pnpm run bench`.
const SCALES = [100, 1_000, 10_000];

for (const entityCount of SCALES) {
  describe(`transform upload @ ${entityCount} entities`, () => {
    const { world, assets } = buildExtractionScene(entityCount);
    const snapshot = extractRenderSnapshot(world, assets, { frame: 1 });
    const packed = packSnapshotTransforms(snapshot);
    const scratch = createWorldTransformBufferDescriptorScratch();
    const backing = new Uint8Array(packed.data.byteLength);
    const sourceBytes = new Uint8Array(
      packed.data.buffer,
      packed.data.byteOffset,
      packed.data.byteLength,
    );

    bench("writeWorldTransformBufferDescriptor", () => {
      writeWorldTransformBufferDescriptor(packed, scratch);
    });

    bench("simulated writeBuffer host copy", () => {
      backing.set(sourceBytes);
    });
  });
}
