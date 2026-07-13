import { describe, expect, it } from "vitest";
import type {
  BatchCompatibilityKey,
  MeshDrawPacket,
  RenderSnapshot,
  RenderSortKey,
  ViewPacket,
} from "@aperture-engine/render";
import {
  createMaterialHandle,
  createMeshHandle,
} from "@aperture-engine/simulation";
import {
  CLIP_PLANE_PIPELINE_FEATURE,
  injectCameraClipPlanesWgsl,
  pipelineKeyIncludesClip,
  withClipPlanePipelineKeys,
  withInjectedClipPlanes,
} from "@aperture-engine/webgpu";
import {
  DEBUG_NORMAL_MESH_SHADER,
  MATCAP_MESH_SHADER,
  STANDARD_MESH_SHADER,
  UNLIT_MESH_SHADER,
  UNLIT_MESH_WGSL,
} from "@aperture-engine/webgpu/test-support";

// Pre-change (no-clip) unlit view struct + fragment entry, pinned so this test
// fails loudly if the base shader source or the no-clip pass-through ever drifts.
const UNLIT_NO_CLIP_VIEW_STRUCT = `struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
};`;

const DISCARD_TEST_SNIPPET =
  "dot(input.worldPosition, apertureClipPlane.xyz) + apertureClipPlane.w < 0.0";

describe("injectCameraClipPlanesWgsl (D2)", () => {
  it("extends the view struct and injects the discard loop for the unlit shader", () => {
    const clipped = injectCameraClipPlanesWgsl(UNLIT_MESH_WGSL);

    expect(clipped).toContain("clipPlanes: array<vec4f, 8>,");
    expect(clipped).toContain("clipPlaneCount: vec4f,");
    expect(clipped).toContain(DISCARD_TEST_SNIPPET);
    expect(clipped).toContain("discard;");
    // Unlit lacks a world-position varying; the transform must add one plus its
    // vertex write so the fragment discard has a world position to test.
    expect(clipped).toContain("worldPosition: vec3f,");
    expect(clipped).toContain(
      "output.worldPosition = (world * vec4f(input.position, 1.0)).xyz;",
    );
  });

  it("reuses the existing world-position varying for standard and matcap", () => {
    for (const source of [STANDARD_MESH_SHADER.code, MATCAP_MESH_SHADER.code]) {
      const clipped = injectCameraClipPlanesWgsl(source);

      expect(clipped).toContain(DISCARD_TEST_SNIPPET);
      // The varying is NOT duplicated (the vertex output already interpolates it).
      expect(occurrences(clipped, "worldPosition: vec3f")).toBe(1);
      // No synthetic vertex write is injected when the varying already exists.
      expect(clipped).not.toContain(
        "output.worldPosition = (world * vec4f(input.position, 1.0)).xyz;",
      );
    }
  });

  it("adds a world-position varying to the debug-normal shader", () => {
    const clipped = injectCameraClipPlanesWgsl(DEBUG_NORMAL_MESH_SHADER.code);

    expect(clipped).toContain("worldPosition: vec3f,");
    expect(clipped).toContain(DISCARD_TEST_SNIPPET);
    expect(clipped).toContain(
      "output.worldPosition = (world * vec4f(input.position, 1.0)).xyz;",
    );
  });
});

describe("withInjectedClipPlanes byte-identity (D2)", () => {
  it("returns the shader UNCHANGED when clipping is disabled", () => {
    const passthrough = withInjectedClipPlanes(UNLIT_MESH_SHADER, false);

    expect(passthrough).toBe(UNLIT_MESH_SHADER);
    expect(passthrough.code).toBe(UNLIT_MESH_WGSL);
    // Pinned pre-change literal: the base unlit view struct is the smaller, no-fog
    // no-clip layout, and the no-clip path never rewrites it.
    expect(passthrough.code).toContain(UNLIT_NO_CLIP_VIEW_STRUCT);
    expect(passthrough.code).not.toContain("clipPlanes");
  });

  it("relabels and rewrites the shader when clipping is enabled", () => {
    const clipped = withInjectedClipPlanes(UNLIT_MESH_SHADER, true);

    expect(clipped).not.toBe(UNLIT_MESH_SHADER);
    expect(clipped.label).toBe(`${UNLIT_MESH_SHADER.label}-clip`);
    expect(clipped.code).toContain("clipPlanes: array<vec4f, 8>,");
  });
});

describe("pipelineKeyIncludesClip (D2)", () => {
  it("matches the standalone clip token only", () => {
    expect(pipelineKeyIncludesClip("standard|clip|opaque|back|less|none")).toBe(
      true,
    );
    expect(pipelineKeyIncludesClip("standard|opaque|back|less|none")).toBe(
      false,
    );
    // A substring like "clipboard" must not false-match the standalone token.
    expect(
      pipelineKeyIncludesClip("unlit|clipboard|opaque|back|less|none"),
    ).toBe(false);
    expect(pipelineKeyIncludesClip(undefined)).toBe(false);
  });
});

describe("withClipPlanePipelineKeys (D2)", () => {
  const BASE_KEY = "standard|opaque|back|less|none";

  it("injects the clip token into every mesh draw when a view clips", () => {
    const result = withClipPlanePipelineKeys(
      snapshotWith({
        views: [view(1, { clipPlanes: [[1, 0, 0, 0]] })],
        meshDraws: [meshDraw(BASE_KEY)],
      }),
    );

    expect(result.meshDraws[0]?.batchKey.pipelineKey).toBe(
      "standard|clip|opaque|back|less|none",
    );
    expect(result.meshDraws[0]?.sortKey.pipelineKey).toBe(
      "standard|clip|opaque|back|less|none",
    );
  });

  it("leaves pipeline keys byte-identical when no view clips", () => {
    const input = snapshotWith({
      views: [view(1, {})],
      meshDraws: [meshDraw(BASE_KEY)],
    });
    const result = withClipPlanePipelineKeys(input);

    expect(result).toBe(input);
    // Pinned pre-change literal.
    expect(result.meshDraws[0]?.batchKey.pipelineKey).toBe(BASE_KEY);
    expect(
      pipelineKeyIncludesClip(result.meshDraws[0]?.batchKey.pipelineKey),
    ).toBe(false);
  });

  it("does not re-inject the clip token when it is already present", () => {
    const result = withClipPlanePipelineKeys(
      snapshotWith({
        views: [view(1, { clipPlanes: [[1, 0, 0, 0]] })],
        meshDraws: [
          meshDraw(
            `standard|${CLIP_PLANE_PIPELINE_FEATURE}|opaque|back|less|none`,
          ),
        ],
      }),
    );

    expect(result.meshDraws[0]?.batchKey.pipelineKey).toBe(
      "standard|clip|opaque|back|less|none",
    );
  });
});

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

function view(
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

function meshDraw(pipelineKey: string): MeshDrawPacket {
  const batchKey: BatchCompatibilityKey = {
    pipelineKey,
    materialKey: "material",
    meshLayoutKey: "layout",
    topology: "triangle-list",
    instanced: false,
    skinned: false,
    morphed: false,
  };
  const sortKey: RenderSortKey = {
    queue: "opaque",
    viewId: 1,
    layer: 0,
    order: 0,
    pipelineKey,
    materialKey: "material",
    meshKey: "mesh",
    depth: 0,
    stableId: 0,
  };

  return {
    renderId: 1,
    entity: { index: 1, generation: 0 },
    mesh: createMeshHandle("clip-mesh"),
    material: createMaterialHandle("clip-material"),
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset: 0,
    boundsIndex: 0,
    layerMask: 1,
    sortKey,
    batchKey,
  };
}

function snapshotWith(input: {
  readonly views: readonly ViewPacket[];
  readonly meshDraws: readonly MeshDrawPacket[];
}): RenderSnapshot {
  return {
    frame: 1,
    views: input.views,
    meshDraws: input.meshDraws,
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(0),
    viewMatrices: new Float32Array(0),
    diagnostics: [],
    report: {
      views: input.views.length,
      meshDraws: input.meshDraws.length,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}
