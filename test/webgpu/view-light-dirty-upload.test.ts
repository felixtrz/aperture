import { describe, expect, it } from "vitest";
import {
  createPackedSnapshotViewUniformsScratch,
  writePackedSnapshotViewUniforms,
  type RenderSnapshot,
} from "@aperture-engine/render";
import type { LightPacket } from "@aperture-engine/render";
import {
  PACKED_LIGHT_FLOAT_STRIDE,
  PACKED_LIGHT_METADATA_STRIDE,
  createLightBufferDescriptorScratch,
  writeLightBufferDescriptor,
} from "@aperture-engine/webgpu/test-support";
import { writeBufferDataDirtyRange } from "../../packages/webgpu/src/app/app-frame-resource-utils.js";

// AI-65 (readiness roadmap R5): the dirty/skip upload contract generalized to
// view uniforms (versioned shared scratch) and light buffers (per-route
// double-buffered scratch).

function viewSnapshot(input: {
  readonly viewIds: readonly number[];
  readonly viewMatrices: Float32Array;
}): RenderSnapshot {
  return {
    frame: 1,
    views: input.viewIds.map((viewId, index) => ({
      viewId,
      camera: { index: viewId, generation: 0 },
      priority: 0,
      layerMask: 1,
      viewProjectionMatrixOffset: index * 32,
      viewMatrixOffset: index * 32 + 16,
      renderTarget: null,
    })),
    meshDraws: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(0),
    viewMatrices: input.viewMatrices,
    diagnostics: [],
    report: {
      views: input.viewIds.length,
      meshDraws: 0,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  } as unknown as RenderSnapshot;
}

function viewMatrices(viewCount: number, seed = 0): Float32Array {
  const data = new Float32Array(viewCount * 32);

  for (let index = 0; index < data.length; index += 1) {
    data[index] = index + seed;
  }

  return data;
}

describe("view uniform dirty tracking (AI-65)", () => {
  it("reports null for identical frames and a window for a camera move", () => {
    const scratch = createPackedSnapshotViewUniformsScratch();
    const matrices = viewMatrices(1);

    const first = writePackedSnapshotViewUniforms(
      viewSnapshot({ viewIds: [1], viewMatrices: matrices }),
      scratch,
    );
    expect(first.dirtyRange).toMatchObject({ full: true });
    expect(first.contentVersion).toBe(1);

    const second = writePackedSnapshotViewUniforms(
      viewSnapshot({ viewIds: [1], viewMatrices: new Float32Array(matrices) }),
      scratch,
    );
    expect(second.dirtyRange).toBeNull();
    expect(second.contentVersion).toBe(1);

    const movedMatrices = new Float32Array(matrices);
    movedMatrices[3] = 999; // one view-projection float
    const third = writePackedSnapshotViewUniforms(
      viewSnapshot({ viewIds: [1], viewMatrices: movedMatrices }),
      scratch,
    );
    expect(third.contentVersion).toBe(2);
    expect(third.dirtyRange).toMatchObject({ floatOffset: 3, full: false });
  });

  it("treats a view-count change as a full range", () => {
    const scratch = createPackedSnapshotViewUniformsScratch();
    writePackedSnapshotViewUniforms(
      viewSnapshot({ viewIds: [1], viewMatrices: viewMatrices(1) }),
      scratch,
    );

    const grown = writePackedSnapshotViewUniforms(
      viewSnapshot({ viewIds: [1, 2], viewMatrices: viewMatrices(2) }),
      scratch,
    );
    expect(grown.dirtyRange).toMatchObject({ floatOffset: 0, full: true });
  });
});

function light(seed: number, intensity = 10 * seed): LightPacket {
  return {
    lightId: 100 + seed,
    entity: { index: seed, generation: 0 },
    kind: "point",
    color: [1, 0.5, 0.25, 1],
    intensity,
    range: 20,
    innerConeAngle: 0.1,
    outerConeAngle: 0.2,
    width: 2.5,
    height: 1.5,
    worldTransformOffset: 16 * seed,
    layerMask: 1,
  } as LightPacket;
}

describe("light buffer dirty tracking (AI-65)", () => {
  it("skips identical frames and windows a single changed light", () => {
    const scratch = createLightBufferDescriptorScratch();
    const lights = [light(1), light(2), light(3), light(4)];

    const first = writeLightBufferDescriptor(lights, scratch);
    expect(first.floatsDirty).toMatchObject({ full: true });
    expect(first.metadataDirty).toMatchObject({ full: true });

    const second = writeLightBufferDescriptor(
      lights.map((entry) => ({ ...entry })),
      scratch,
    );
    expect(second.floatsDirty).toBeNull();
    expect(second.metadataDirty).toBeNull();

    // Change one light's intensity: the float window stays inside that
    // light's stride and the (unchanged) metadata buffer reports null.
    const changed = lights.map((entry, index) =>
      index === 2 ? { ...entry, intensity: 999 } : { ...entry },
    );
    const third = writeLightBufferDescriptor(changed, scratch);

    expect(third.metadataDirty).toBeNull();
    expect(third.floatsDirty).toMatchObject({ full: false });
    const window = third.floatsDirty;
    expect(window?.floatOffset).toBeGreaterThanOrEqual(
      2 * PACKED_LIGHT_FLOAT_STRIDE,
    );
    expect(
      (window?.floatOffset ?? 0) + (window?.floatCount ?? 0),
    ).toBeLessThanOrEqual(3 * PACKED_LIGHT_FLOAT_STRIDE);
  });

  it("treats light-count changes as full ranges", () => {
    const scratch = createLightBufferDescriptorScratch();
    writeLightBufferDescriptor([light(1)], scratch);

    const grown = writeLightBufferDescriptor([light(1), light(2)], scratch);
    expect(grown.floatsDirty).toMatchObject({ full: true });
    expect(grown.metadataDirty).toMatchObject({ full: true });
  });

  it("uploads byte-identical content through the dirty-range path", () => {
    const scratch = createLightBufferDescriptorScratch();
    const lights = [light(1), light(2), light(3)];
    const first = writeLightBufferDescriptor(lights, scratch);

    const backing = new Uint8Array(first.packed.floats.byteLength);
    const writes: { offset: number; size: number }[] = [];
    const device = {
      queue: {
        writeBuffer: (
          _buffer: unknown,
          bufferOffset: number,
          data: ArrayBufferLike,
          dataOffset?: number,
          size?: number,
        ) => {
          const bytes = new Uint8Array(data, dataOffset ?? 0, size);
          backing.set(bytes, bufferOffset);
          writes.push({ offset: bufferOffset, size: bytes.byteLength });
        },
      },
    };

    expect(
      writeBufferDataDirtyRange(
        device,
        {},
        first.packed.floats,
        first.floatsDirty,
      ),
    ).toBe("full");

    const changed = lights.map((entry, index) =>
      index === 1 ? { ...entry, intensity: -5 } : { ...entry },
    );
    const second = writeLightBufferDescriptor(changed, scratch);
    writes.length = 0;

    expect(
      writeBufferDataDirtyRange(
        device,
        {},
        second.packed.floats,
        second.floatsDirty,
      ),
    ).toBe("sub-range");
    expect(writes).toHaveLength(1);
    expect(writes[0]?.size).toBeLessThan(second.packed.floats.byteLength);

    // Equivalence: the backing equals a forced full upload of the same state.
    expect(Array.from(new Float32Array(backing.buffer))).toEqual(
      Array.from(second.packed.floats),
    );

    // Skip path issues zero bytes.
    const third = writeLightBufferDescriptor(
      changed.map((entry) => ({ ...entry })),
      scratch,
    );
    writes.length = 0;
    expect(
      writeBufferDataDirtyRange(
        device,
        {},
        third.packed.floats,
        third.floatsDirty,
      ),
    ).toBe("skipped");
    expect(writes).toHaveLength(0);
  });

  it("metadata window stays inside the changed light's stride", () => {
    const scratch = createLightBufferDescriptorScratch();
    const lights = [light(1), light(2), light(3)];
    writeLightBufferDescriptor(lights, scratch);

    const changed = lights.map((entry, index) =>
      index === 1 ? { ...entry, layerMask: 0b100 } : { ...entry },
    );
    const second = writeLightBufferDescriptor(changed, scratch);

    expect(second.floatsDirty).toBeNull();
    expect(second.metadataDirty).toMatchObject({ full: false });
    const window = second.metadataDirty;
    expect(window?.floatOffset).toBeGreaterThanOrEqual(
      1 * PACKED_LIGHT_METADATA_STRIDE,
    );
    expect(
      (window?.floatOffset ?? 0) + (window?.floatCount ?? 0),
    ).toBeLessThanOrEqual(2 * PACKED_LIGHT_METADATA_STRIDE);
  });
});
