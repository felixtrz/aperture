import { describe, expect, it } from "vitest";

import {
  createDirectLightReadinessReport,
  directLightReadinessReportToJson,
  directLightReadinessReportToJsonValue,
  directLightReadinessResourceStateFromStandardFrameResources,
  type LightPacket,
  type RenderSnapshot,
} from "@aperture-engine/webgpu/test-support";

describe("direct light readiness report", () => {
  it("summarizes extracted light kinds and ready WebGPU resources", () => {
    const report = createDirectLightReadinessReport({
      snapshot: snapshot({
        lights: [
          light("ambient", 1),
          light("directional", 2),
          light("point", 3),
          light("spot", 4),
          light("rect-area", 5, "disk"),
          light("environment", 6),
        ],
      }),
      resources: {
        lightGpuBufferResourceKey: "light-buffer:main",
        lightBindGroupLayoutKey: "bind-group-layout:lights/group-3",
        lightBindGroupResourceKey:
          "bind-group:lights/group-3/light-buffer:main",
      },
    });

    expect(report).toEqual({
      ready: true,
      lightCounts: {
        total: 6,
        direct: 4,
        ambient: 1,
        directional: 1,
        point: 1,
        spot: 1,
        rectArea: 1,
        environment: 1,
        areaShapes: {
          rect: 0,
          disk: 1,
          sphere: 0,
        },
      },
      sections: {
        lightGpuBuffers: true,
        lightBindGroupLayout: true,
        lightBindGroup: true,
        shaderMetadata: true,
      },
      resources: {
        lightGpuBufferResourceKey: "light-buffer:main",
        lightBindGroupLayoutKey: "bind-group-layout:lights/group-3",
        lightBindGroupResourceKey:
          "bind-group:lights/group-3/light-buffer:main",
      },
      shaderMetadata: {
        valid: true,
        diagnostics: [],
      },
      diagnostics: [],
    });
  });

  it("reports missing resources and metadata mismatch without raw GPU objects", () => {
    const report = createDirectLightReadinessReport({
      snapshot: snapshot({ lights: [] }),
      resources: null,
      metadata: {
        valid: false,
        diagnostics: [
          {
            code: "lightShaderBinding.missingBinding",
            bindingId: "lightFloats",
            binding: 0,
            message:
              "Light bind group layout is missing 'lightFloats' at binding 0.",
          },
        ],
      },
    });
    const value = directLightReadinessReportToJsonValue(report);
    const json = directLightReadinessReportToJson(report);

    expect(value).toMatchObject({
      ready: false,
      lightCounts: {
        total: 0,
        direct: 0,
        ambient: 0,
        directional: 0,
        point: 0,
        spot: 0,
        rectArea: 0,
        environment: 0,
        areaShapes: {
          rect: 0,
          disk: 0,
          sphere: 0,
        },
      },
      sections: {
        lightGpuBuffers: false,
        lightBindGroupLayout: false,
        lightBindGroup: false,
        shaderMetadata: false,
      },
      resources: {
        lightGpuBufferResourceKey: null,
        lightBindGroupLayoutKey: null,
        lightBindGroupResourceKey: null,
      },
      diagnostics: [
        { code: "lightShaderReadiness.missingLightGpuBuffers" },
        { code: "lightShaderReadiness.missingLayout" },
        { code: "lightShaderReadiness.missingBindGroup" },
        { code: "lightShaderReadiness.metadataInvalid" },
      ],
    });
    expect(JSON.parse(json) as unknown).toEqual(value);
    expect(json).not.toMatch(/GPUBuffer|GPUBindGroup|GPUDevice|raw-light/);
  });

  it("derives resource keys from standard frame resources without handles", () => {
    const state = directLightReadinessResourceStateFromStandardFrameResources({
      lightGpuBuffers: {
        valid: true,
        lightBuffer: {
          resourceKey: "light-buffer:main",
          usageIntent: "read-only-storage",
          count: 1,
          byteLength: 120,
          floatByteLength: 96,
          metadataByteLength: 24,
          packed: {
            count: 1,
            floatStride: 24,
            metadataStride: 6,
            floats: new Float32Array(24),
            metadata: new Int32Array(6),
          },
        },
        descriptorPlan: null,
        resource: {
          resourceKey: "light-buffer:main",
          floatResourceKey: "light-buffer:main/floats",
          metadataResourceKey: "light-buffer:main/metadata",
          floatBuffer: { raw: "gpu-buffer" },
          metadataBuffer: { raw: "gpu-buffer" },
          count: 1,
        },
        diagnostics: [],
      },
      lightBindGroup: {
        group: 3,
        resourceKey: "bind-group:lights/group-3/light-buffer:main",
        layoutKey: "bind-group-layout:lights/group-3",
        bindGroup: { raw: "gpu-bind-group" },
        entryResourceKeys: [
          "light-buffer:main/floats",
          "light-buffer:main/metadata",
        ],
      },
    });

    expect(state).toEqual({
      lightGpuBufferResourceKey: "light-buffer:main",
      lightBindGroupLayoutKey: "bind-group-layout:lights/group-3",
      lightBindGroupResourceKey: "bind-group:lights/group-3/light-buffer:main",
    });
    expect(JSON.stringify(state)).not.toMatch(/gpu-buffer|gpu-bind-group/);
  });
});

function snapshot(input: {
  readonly lights?: readonly LightPacket[];
}): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws: [],
    lights: input.lights ?? [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(),
    viewMatrices: new Float32Array(),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 0,
      lights: input.lights?.length ?? 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

function light(
  kind: LightPacket["kind"],
  seed: number,
  shape?: LightPacket["shape"],
): LightPacket {
  return {
    lightId: seed,
    entity: { index: seed, generation: 1 },
    kind,
    ...(shape === undefined ? {} : { shape }),
    color: [seed, seed + 0.1, seed + 0.2, 1],
    intensity: seed + 1,
    range: seed + 2,
    innerConeAngle: 0.1,
    outerConeAngle: 0.3,
    width: 2,
    height: 1,
    worldTransformOffset: seed * 16,
    layerMask: 1,
  };
}
