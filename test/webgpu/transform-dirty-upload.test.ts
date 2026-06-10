import { describe, expect, it } from "vitest";
import {
  createPackedSnapshotTransformsScratch,
  packSnapshotTransforms,
  writePackedSnapshotTransforms,
  TRANSFORM_DIRTY_FULL_WRITE_FRACTION,
} from "@aperture-engine/render";
import {
  writeBufferData,
  writeVersionedBufferData,
} from "../../packages/webgpu/src/app/app-frame-resource-utils.js";

// AI-64 (readiness roadmap R5): dirty-range transform packing + the
// version-gated upload protocol consumed by the material frame paths.

const MATRIX_FLOATS = 16;

function snapshotWith(transforms: Float32Array, drawCount: number) {
  return {
    transforms,
    meshDraws: Array.from({ length: drawCount }, (_, index) => ({
      renderId: index + 1,
      worldTransformOffset: index * MATRIX_FLOATS,
    })) as never[],
  } as Parameters<typeof writePackedSnapshotTransforms>[0];
}

function identityGrid(matrixCount: number): Float32Array {
  const data = new Float32Array(matrixCount * MATRIX_FLOATS);

  for (let m = 0; m < matrixCount; m += 1) {
    const base = m * MATRIX_FLOATS;
    data[base] = 1;
    data[base + 5] = 1;
    data[base + 10] = 1;
    data[base + 15] = 1;
    // Distinct translations so matrices are not identical to each other.
    data[base + 12] = m * 2;
  }

  return data;
}

describe("writePackedSnapshotTransforms dirty ranges", () => {
  it("reports a full range on the first frame and null when nothing changed", () => {
    const scratch = createPackedSnapshotTransformsScratch();
    const transforms = identityGrid(4);

    const first = writePackedSnapshotTransforms(
      snapshotWith(transforms, 4),
      scratch,
    );
    expect(first.dirtyRange).toEqual({
      floatOffset: 0,
      floatCount: 64,
      full: true,
    });
    expect(first.contentVersion).toBe(1);

    const second = writePackedSnapshotTransforms(
      snapshotWith(new Float32Array(transforms), 4),
      scratch,
    );
    expect(second.dirtyRange).toBeNull();
    expect(second.contentVersion).toBe(1);
    expect(Array.from(second.data.subarray(0, 64))).toEqual(
      Array.from(transforms),
    );
  });

  it("emits the contiguous window covering a single moved matrix", () => {
    const scratch = createPackedSnapshotTransformsScratch();
    const transforms = identityGrid(8);
    writePackedSnapshotTransforms(snapshotWith(transforms, 8), scratch);

    const moved = new Float32Array(transforms);
    moved[2 * MATRIX_FLOATS + 12] = 99; // translate matrix #2 on x
    moved[2 * MATRIX_FLOATS + 13] = -7; // and y

    const result = writePackedSnapshotTransforms(
      snapshotWith(moved, 8),
      scratch,
    );

    expect(result.contentVersion).toBe(2);
    expect(result.dirtyRange).toEqual({
      floatOffset: 2 * MATRIX_FLOATS + 12,
      floatCount: 2,
      full: false,
    });
    // The scratch content matches a cold full pack byte-for-byte.
    expect(Array.from(result.data.subarray(0, moved.length))).toEqual(
      Array.from(packSnapshotTransforms(snapshotWith(moved, 8)).data),
    );
  });

  it("coalesces multiple moved matrices into one window spanning first to last change", () => {
    const scratch = createPackedSnapshotTransformsScratch();
    const transforms = identityGrid(10);
    writePackedSnapshotTransforms(snapshotWith(transforms, 10), scratch);

    const moved = new Float32Array(transforms);
    moved[1 * MATRIX_FLOATS + 12] = 50;
    moved[3 * MATRIX_FLOATS + 12] = 60;

    const result = writePackedSnapshotTransforms(
      snapshotWith(moved, 10),
      scratch,
    );

    expect(result.dirtyRange).toEqual({
      floatOffset: 1 * MATRIX_FLOATS + 12,
      floatCount: 2 * MATRIX_FLOATS + 1,
      full: false,
    });
  });

  it("falls back to one full write when the changed span crosses the threshold", () => {
    const scratch = createPackedSnapshotTransformsScratch();
    const transforms = identityGrid(4);
    writePackedSnapshotTransforms(snapshotWith(transforms, 4), scratch);

    const moved = new Float32Array(transforms);
    moved[12] = 42; // first matrix
    moved[3 * MATRIX_FLOATS + 12] = 43; // last matrix: span = whole buffer

    const result = writePackedSnapshotTransforms(
      snapshotWith(moved, 4),
      scratch,
    );

    expect(result.dirtyRange).toEqual({
      floatOffset: 0,
      floatCount: 64,
      full: true,
    });
    expect(TRANSFORM_DIRTY_FULL_WRITE_FRACTION).toBeLessThanOrEqual(
      (3 * MATRIX_FLOATS + 1) / 64,
    );
  });

  it("treats float-count changes and capacity growth as full writes", () => {
    const scratch = createPackedSnapshotTransformsScratch();
    writePackedSnapshotTransforms(snapshotWith(identityGrid(2), 2), scratch);

    const grown = writePackedSnapshotTransforms(
      snapshotWith(identityGrid(6), 6),
      scratch,
    );
    expect(grown.dirtyRange).toEqual({
      floatOffset: 0,
      floatCount: 96,
      full: true,
    });

    const shrunk = writePackedSnapshotTransforms(
      snapshotWith(identityGrid(3), 3),
      scratch,
    );
    expect(shrunk.dirtyRange).toEqual({
      floatOffset: 0,
      floatCount: 48,
      full: true,
    });
  });

  it("leaves the allocating packSnapshotTransforms without version history", () => {
    const packed = packSnapshotTransforms(snapshotWith(identityGrid(2), 2));

    expect(packed.contentVersion).toBeUndefined();
    expect(packed.dirtyRange).toBeUndefined();
  });
});

interface RecordedWrite {
  readonly bufferOffset: number;
  readonly size: number;
}

function fakeDevice(backing: Uint8Array): {
  readonly device: unknown;
  readonly writes: RecordedWrite[];
} {
  const writes: RecordedWrite[] = [];

  return {
    writes,
    device: {
      queue: {
        writeBuffer: (
          _buffer: unknown,
          bufferOffset: number,
          data: ArrayBufferLike,
          dataOffset?: number,
          size?: number,
        ) => {
          const bytes = new Uint8Array(
            data,
            dataOffset ?? 0,
            size ?? undefined,
          );
          backing.set(bytes, bufferOffset);
          writes.push({ bufferOffset, size: bytes.byteLength });
        },
      },
    },
  };
}

describe("writeVersionedBufferData protocol", () => {
  it("skips, sub-ranges, and falls back exactly per the version protocol — with byte-identical results", () => {
    const scratch = createPackedSnapshotTransformsScratch();
    const transforms = identityGrid(6);
    const buffer = {};

    // Frame 1: cold creation wrote the full content (simulated here).
    let packed = writePackedSnapshotTransforms(
      snapshotWith(transforms, 6),
      scratch,
    );
    const backing = new Uint8Array(transforms.byteLength);
    const gpu = fakeDevice(backing);
    expect(
      writeBufferData(gpu.device, buffer, packed.data.subarray(0, 96)),
    ).toBe(true);
    const target: { version?: number | undefined } = {
      version: packed.contentVersion,
    };
    gpu.writes.length = 0;

    // Frame 2: unchanged content — zero GPU bytes.
    packed = writePackedSnapshotTransforms(
      snapshotWith(new Float32Array(transforms), 6),
      scratch,
    );
    expect(
      writeVersionedBufferData(
        gpu.device,
        buffer,
        packed.data.subarray(0, 96),
        packed,
        target,
      ),
    ).toBe("skipped");
    expect(gpu.writes).toHaveLength(0);

    // Frame 3: one matrix moves — one 8-byte window (two floats).
    const moved = new Float32Array(transforms);
    moved[4 * MATRIX_FLOATS + 12] = 11;
    moved[4 * MATRIX_FLOATS + 13] = 12;
    packed = writePackedSnapshotTransforms(snapshotWith(moved, 6), scratch);
    expect(
      writeVersionedBufferData(
        gpu.device,
        buffer,
        packed.data.subarray(0, 96),
        packed,
        target,
      ),
    ).toBe("sub-range");
    expect(gpu.writes).toEqual([
      { bufferOffset: (4 * MATRIX_FLOATS + 12) * 4, size: 8 },
    ]);
    expect(Array.from(new Float32Array(backing.buffer))).toEqual(
      Array.from(moved),
    );

    // A second route that never saw frame 3 (stale by one version with a
    // non-full range applies the window; stale by more falls back to full).
    const staleTarget: { version?: number | undefined } = {
      version: (packed.contentVersion ?? 0) - 2,
    };
    gpu.writes.length = 0;
    expect(
      writeVersionedBufferData(
        gpu.device,
        buffer,
        packed.data.subarray(0, 96),
        packed,
        staleTarget,
      ),
    ).toBe("full");
    expect(gpu.writes).toEqual([{ bufferOffset: 0, size: 96 * 4 }]);
    expect(staleTarget.version).toBe(packed.contentVersion);

    // No version history (allocating pack) — always a full write.
    gpu.writes.length = 0;
    const allocPacked = packSnapshotTransforms(snapshotWith(moved, 6));
    expect(
      writeVersionedBufferData(
        gpu.device,
        buffer,
        allocPacked.data,
        allocPacked,
        {},
      ),
    ).toBe("full");
    expect(gpu.writes).toEqual([{ bufferOffset: 0, size: 96 * 4 }]);
  });

  it("returns false without stamping when the device write fails", () => {
    const scratch = createPackedSnapshotTransformsScratch();
    const packed = writePackedSnapshotTransforms(
      snapshotWith(identityGrid(2), 2),
      scratch,
    );
    const target: { version?: number | undefined } = {
      version: (packed.contentVersion ?? 0) - 1,
    };

    expect(
      writeVersionedBufferData({ queue: {} }, {}, packed.data, packed, target),
    ).toBe(false);
    expect(target.version).toBe((packed.contentVersion ?? 0) - 1);
  });
});

describe("dirty-range upload driven by a real ECS world", () => {
  it("uploads only the moved entity's matrix window after extraction", async () => {
    const {
      AssetRegistry,
      WorldTransform,
      createMaterialHandle,
      createMeshHandle,
      createRootTransform,
      createWorld,
      registerMetadataComponents,
      registerTransformComponents,
    } = await import("@aperture-engine/simulation");
    const {
      Material,
      Mesh,
      RenderLayer,
      Visibility,
      Camera,
      createBoxMeshAsset,
      createCamera,
      createUnlitMaterialAsset,
      extractRenderSnapshot,
      registerRenderAuthoringComponents,
    } = await import("@aperture-engine/render");

    const world = createWorld({ entityCapacity: 16 });
    registerTransformComponents(world);
    registerMetadataComponents(world);
    registerRenderAuthoringComponents(world);

    const assets = new AssetRegistry();
    const meshHandle = createMeshHandle("dirty-cube");
    const materialHandle = createMaterialHandle("dirty-unlit");
    assets.register(meshHandle);
    assets.register(materialHandle);
    assets.markReady(meshHandle, createBoxMeshAsset());
    assets.markReady(materialHandle, createUnlitMaterialAsset());

    const camera = world.createEntity();
    camera.addComponent(
      WorldTransform,
      createRootTransform({ translation: [0, 0, 10] }).world,
    );
    camera.addComponent(Camera, createCamera({ priority: 0, layerMask: 1 }));

    const entities = Array.from({ length: 5 }, (_, index) => {
      const entity = world.createEntity();
      entity.addComponent(
        WorldTransform,
        createRootTransform({ translation: [index * 2, 0, 0] }).world,
      );
      entity.addComponent(Mesh, { meshId: "mesh:dirty-cube" });
      entity.addComponent(Material, { materialId: "material:dirty-unlit" });
      entity.addComponent(RenderLayer, { mask: 1 });
      entity.addComponent(Visibility);
      return entity;
    });

    const scratch = createPackedSnapshotTransformsScratch();
    const first = extractRenderSnapshot(world, assets, { frame: 1 });
    let packed = writePackedSnapshotTransforms(first, scratch);
    const floatCount = first.transforms.length;
    const backing = new Uint8Array(floatCount * 4);
    const gpu = fakeDevice(backing);
    const buffer = {};
    const target: { version?: number | undefined } = {};

    expect(
      writeVersionedBufferData(
        gpu.device,
        buffer,
        packed.data.subarray(0, floatCount),
        packed,
        target,
      ),
    ).toBe("full");

    // Static frame: zero GPU bytes.
    gpu.writes.length = 0;
    packed = writePackedSnapshotTransforms(
      extractRenderSnapshot(world, assets, { frame: 2 }),
      scratch,
    );
    expect(
      writeVersionedBufferData(
        gpu.device,
        buffer,
        packed.data.subarray(0, floatCount),
        packed,
        target,
      ),
    ).toBe("skipped");
    expect(gpu.writes).toHaveLength(0);

    // Move exactly one entity, re-extract, and assert the single recorded
    // write lands entirely inside that entity's 64-byte matrix window.
    // Keep the moved entity inside the camera frustum so extraction does not
    // cull its draw (the camera sits at z=10 looking down -Z).
    const moved = entities[2];
    expect(moved).toBeDefined();
    moved?.getVectorView(WorldTransform, "col3").set([4.5, 1.25, 0.5, 1]);

    const third = extractRenderSnapshot(world, assets, { frame: 3 });
    const movedDraw = third.meshDraws.find(
      (draw) => draw.entity.index === moved?.index,
    );
    expect(movedDraw).toBeDefined();

    packed = writePackedSnapshotTransforms(third, scratch);
    gpu.writes.length = 0;
    expect(
      writeVersionedBufferData(
        gpu.device,
        buffer,
        packed.data.subarray(0, floatCount),
        packed,
        target,
      ),
    ).toBe("sub-range");

    const matrixByteStart = (movedDraw?.worldTransformOffset ?? -1) * 4;
    expect(gpu.writes).toHaveLength(1);
    const write = gpu.writes[0];
    expect(write?.bufferOffset).toBeGreaterThanOrEqual(matrixByteStart);
    expect((write?.bufferOffset ?? 0) + (write?.size ?? 0)).toBeLessThanOrEqual(
      matrixByteStart + 64,
    );
    expect(write?.size).toBeGreaterThan(0);

    // Equivalence: the GPU backing equals the freshly extracted transforms.
    expect(Array.from(new Float32Array(backing.buffer))).toEqual(
      Array.from(third.transforms),
    );
  });
});
