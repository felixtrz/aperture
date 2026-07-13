import { describe, expect, it } from "vitest";
import {
  MAX_CLIP_PLANES,
  PACKED_VIEW_UNIFORM_FLOAT_STRIDE,
  VIEW_CLIP_PLANE_COUNT_FLOAT_OFFSET,
  VIEW_CLIP_PLANES_FLOAT_OFFSET,
  createCameraClipPlanes,
  createStandardMaterialAsset,
  decodeSnapshotPackets,
  encodeSnapshotPackets,
  normalizeClipPlanes,
  packSnapshotViewUniforms,
  resolveClipPlanes,
  validateMaterialAsset,
  type RenderSnapshot,
  type SnapshotPacketBundle,
  type ViewPacket,
} from "@aperture-engine/render";

describe("resolveClipPlanes (D2)", () => {
  it("returns the camera planes when only camera planes are provided", () => {
    const resolved = resolveClipPlanes({
      cameraPlanes: [
        [1, 0, 0, 0],
        [0, 1, 0, -2],
      ],
    });

    expect(resolved.planes).toEqual([
      [1, 0, 0, 0],
      [0, 1, 0, -2],
    ]);
    expect(resolved.exceeded).toBe(false);
    expect(resolved.dropped).toBe(0);
  });

  it("unions per-material planes on top of per-camera planes (camera first)", () => {
    const resolved = resolveClipPlanes({
      cameraPlanes: [[1, 0, 0, 0]],
      materialPlanes: [
        [0, 1, 0, -1],
        [0, 0, 1, -2],
      ],
    });

    expect(resolved.planes).toEqual([
      [1, 0, 0, 0],
      [0, 1, 0, -1],
      [0, 0, 1, -2],
    ]);
    expect(resolved.requested).toBe(3);
    expect(resolved.exceeded).toBe(false);
  });

  it("uses only the material planes when no camera planes are present", () => {
    const resolved = resolveClipPlanes({
      materialPlanes: [[0, -1, 0, 3]],
    });

    expect(resolved.planes).toEqual([[0, -1, 0, 3]]);
  });

  it("caps the union at MAX_CLIP_PLANES and reports the overflow", () => {
    const camera = Array.from(
      { length: 6 },
      (_, index) => [index, 0, 0, 0] as const,
    );
    const material = Array.from(
      { length: 4 },
      (_, index) => [0, index, 0, 0] as const,
    );
    const resolved = resolveClipPlanes({
      cameraPlanes: camera,
      materialPlanes: material,
    });

    expect(resolved.planes).toHaveLength(MAX_CLIP_PLANES);
    expect(resolved.requested).toBe(10);
    expect(resolved.dropped).toBe(10 - MAX_CLIP_PLANES);
    expect(resolved.exceeded).toBe(true);
    // The kept planes are the first MAX (camera planes first, then material).
    expect(resolved.planes[0]).toEqual([0, 0, 0, 0]);
    expect(resolved.planes[MAX_CLIP_PLANES - 1]).toEqual([0, 1, 0, 0]);
  });

  it("drops malformed (non-finite) planes when normalizing", () => {
    const normalized = normalizeClipPlanes([
      [1, 0, 0, 0],
      [Number.NaN, 0, 0, 0],
      [0, 1, 0, Number.POSITIVE_INFINITY],
      [0, 0, 1, -1],
    ]);

    expect(normalized).toEqual([
      [1, 0, 0, 0],
      [0, 0, 1, -1],
    ]);
  });
});

describe("createCameraClipPlanes (D2)", () => {
  it("normalizes authored planes into finite tuples", () => {
    const component = createCameraClipPlanes({
      planes: [
        [1, 0, 0, 0],
        [0, 1, 0, -1],
      ],
    });

    expect(component.planes).toEqual([
      [1, 0, 0, 0],
      [0, 1, 0, -1],
    ]);
  });
});

describe("packed view uniform clip block (D2)", () => {
  it("appends the clip plane count and planes after the fog block", () => {
    const result = packSnapshotViewUniforms(
      snapshot({
        views: [
          viewPacket(3, {
            clipPlanes: [
              [1, 0, 0, -0.5],
              [0, 1, 0, -1.5],
            ],
          }),
        ],
        viewMatrices: matrixValues(1),
      }),
    );

    expect(result.data.length).toBe(PACKED_VIEW_UNIFORM_FLOAT_STRIDE);
    // clipPlaneCount vec4: x = active count, yzw padding.
    expect(
      Array.from(
        result.data.slice(
          VIEW_CLIP_PLANE_COUNT_FLOAT_OFFSET,
          VIEW_CLIP_PLANE_COUNT_FLOAT_OFFSET + 4,
        ),
      ),
    ).toEqual([2, 0, 0, 0]);
    // The two planes, then zero-filled remaining capacity.
    expect(
      Array.from(
        result.data.slice(
          VIEW_CLIP_PLANES_FLOAT_OFFSET,
          VIEW_CLIP_PLANES_FLOAT_OFFSET + 8,
        ),
      ),
    ).toEqual([1, 0, 0, -0.5, 0, 1, 0, -1.5]);
    expect(
      Array.from(
        result.data.slice(
          VIEW_CLIP_PLANES_FLOAT_OFFSET + 8,
          VIEW_CLIP_PLANES_FLOAT_OFFSET + MAX_CLIP_PLANES * 4,
        ),
      ),
    ).toEqual(new Array((MAX_CLIP_PLANES - 2) * 4).fill(0));
  });

  it("zero-fills the clip block for a view with no clip planes", () => {
    const result = packSnapshotViewUniforms(
      snapshot({
        views: [viewPacket(4, {})],
        viewMatrices: matrixValues(1),
      }),
    );

    expect(
      Array.from(
        result.data.slice(
          VIEW_CLIP_PLANE_COUNT_FLOAT_OFFSET,
          PACKED_VIEW_UNIFORM_FLOAT_STRIDE,
        ),
      ),
    ).toEqual(
      new Array(
        PACKED_VIEW_UNIFORM_FLOAT_STRIDE - VIEW_CLIP_PLANE_COUNT_FLOAT_OFFSET,
      ).fill(0),
    );
  });
});

describe("packed view packet clip codec round-trip (D2)", () => {
  it("round-trips a view's clip planes through the SAB codec", () => {
    const bundle = packetBundle([
      viewPacket(10, {
        clipPlanes: [
          [1, 0, 0, -0.25],
          [0, 0, 1, -0.75],
        ],
      }),
    ]);
    const encoded = encodeSnapshotPackets(bundle);
    const decoded = decodeSnapshotPackets(encoded.words, encoded.registry);

    expect(decoded.views[0]?.clipPlanes).toEqual([
      [1, 0, 0, -0.25],
      [0, 0, 1, -0.75],
    ]);
  });

  it("omits the clipPlanes field entirely for a non-clip view", () => {
    const bundle = packetBundle([viewPacket(11, {})]);
    const encoded = encodeSnapshotPackets(bundle);
    const decoded = decodeSnapshotPackets(encoded.words, encoded.registry);

    expect(decoded.views[0]).not.toHaveProperty("clipPlanes");
    expect(decoded.views[0]).toEqual(bundle.views[0]);
  });
});

describe("per-material clip plane validation (D2)", () => {
  it("diagnoses a material that declares more than MAX_CLIP_PLANES", () => {
    const material = createStandardMaterialAsset({
      label: "OverClipped",
      renderState: {
        clipPlanes: Array.from(
          { length: MAX_CLIP_PLANES + 2 },
          (_, index) => [index, 0, 0, 0] as const,
        ),
      },
    });
    const report = validateMaterialAsset(material);

    expect(
      report.diagnostics.some(
        (diagnostic) => diagnostic.code === "material.clipPlanesExceedLimit",
      ),
    ).toBe(true);
  });

  it("does not diagnose a material within the clip plane limit", () => {
    const material = createStandardMaterialAsset({
      label: "Clipped",
      renderState: { clipPlanes: [[1, 0, 0, 0]] },
    });
    const report = validateMaterialAsset(material);

    expect(
      report.diagnostics.some(
        (diagnostic) => diagnostic.code === "material.clipPlanesExceedLimit",
      ),
    ).toBe(false);
  });

  it("omits renderState.clipPlanes entirely for a material with no clip planes", () => {
    const material = createStandardMaterialAsset({ label: "NoClip" });

    // Byte-identity: a non-clipping material never grows a clipPlanes field, so
    // it stays on the pre-D2 render-state shape (no pipeline-key participation).
    expect(material.renderState).not.toHaveProperty("clipPlanes");
    expect(
      validateMaterialAsset(material).diagnostics.some((diagnostic) =>
        diagnostic.code.startsWith("material.clipPlanes"),
      ),
    ).toBe(false);
  });
});

function viewPacket(
  viewId: number,
  options: { readonly clipPlanes?: readonly (readonly number[])[] },
): ViewPacket {
  return {
    viewId,
    camera: { index: viewId, generation: 0 },
    priority: 0,
    layerMask: 1,
    viewMatrixOffset: 0,
    projectionMatrixOffset: 0,
    viewProjectionMatrixOffset: 0,
    viewport: [0, 0, 1, 1],
    scissor: [0, 0, 1, 1],
    clearColor: [0, 0, 0, 1],
    clearDepth: 1,
    clearStencil: 0,
    renderTarget: null,
    ...(options.clipPlanes === undefined
      ? {}
      : { clipPlanes: options.clipPlanes }),
  };
}

function packetBundle(views: readonly ViewPacket[]): SnapshotPacketBundle {
  return {
    views,
    meshDraws: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
  };
}

function snapshot(input: {
  readonly views: readonly ViewPacket[];
  readonly viewMatrices: ArrayLike<number>;
}): RenderSnapshot {
  return {
    frame: 1,
    views: input.views,
    meshDraws: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(0),
    viewMatrices: Float32Array.from(input.viewMatrices),
    diagnostics: [],
    report: {
      views: input.views.length,
      meshDraws: 0,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

function matrixValues(start: number): Float32Array {
  return Float32Array.from({ length: 16 }, (_, index) => start + index);
}
