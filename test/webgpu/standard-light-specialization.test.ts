import { describe, expect, it } from "vitest";
import type {
  LightPacket,
  MeshDrawPacket,
  RenderSnapshot,
} from "@aperture-engine/render";
import {
  createMaterialHandle,
  createMeshHandle,
} from "@aperture-engine/simulation";
import { createEmptyRenderSnapshot } from "../../packages/webgpu/src/app/snapshot.js";
import {
  readStandardLightingSpecializationFeatures,
  standardShaderUsesAreaLightLtc,
  withStandardLightingSpecializationPipelineKeys,
} from "../../packages/webgpu/src/materials/standard/standard-light-specialization.js";
import { createStandardPipelineDescriptorPlan } from "../../packages/webgpu/src/materials/standard/standard-pipeline-descriptor.js";
import { createStandardTextureVariantShader } from "../../packages/webgpu/src/materials/standard/standard-shader.js";

const features = {
  baseColorTexture: false,
  metallicRoughnessTexture: false,
  normalTexture: false,
  occlusionTexture: false,
  emissiveTexture: false,
};

function light(kind: LightPacket["kind"], lightId: number): LightPacket {
  return {
    lightId,
    kind,
    entity: { index: lightId, generation: 0 },
    color: [1, 1, 1, 1],
    intensity: 1,
    range: 10,
    innerConeAngle: 0.2,
    outerConeAngle: 0.4,
    worldTransformOffset: 0,
    layerMask: 1,
  };
}

function snapshot(filter: number = 1): RenderSnapshot {
  const pipelineKey = "standard|shadowMap|opaque|back|less|none";
  const batchKey = {
    pipelineKey,
    materialKey: "material:test",
    meshLayoutKey: "primitive-interleaved",
    topology: "triangle-list" as const,
    instanced: false,
    skinned: false,
    morphed: false,
  };
  const draw: MeshDrawPacket = {
    renderId: 1,
    entity: { index: 1, generation: 0 },
    mesh: createMeshHandle("test"),
    material: createMaterialHandle("test"),
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset: 0,
    boundsIndex: 0,
    layerMask: 1,
    castsShadow: true,
    receivesShadow: true,
    batchKey,
    sortKey: {
      queue: "opaque",
      viewId: 0,
      layer: 0,
      order: 0,
      pipelineKey,
      materialKey: "material:test",
      meshKey: "mesh:test",
      depth: 0,
      stableId: 1,
    },
  };
  return {
    ...createEmptyRenderSnapshot(1),
    meshDraws: [draw],
    shadowCasterDraws: [draw],
    lights: [light("ambient", 2), light("directional", 3)],
    shadowRequests: [
      {
        shadowId: 1,
        lightId: 3,
        lightKind: "directional",
        cascadeCount: 1,
        casterLayerMask: 1,
        receiverLayerMask: 1,
        shadowType: filter,
      },
    ],
  };
}

function key(source: RenderSnapshot): string {
  return source.meshDraws[0]!.batchKey.pipelineKey;
}

function pipeline(source: RenderSnapshot) {
  return createStandardPipelineDescriptorPlan({
    batchKey: source.meshDraws[0]!.batchKey,
    colorFormat: "rgba16float",
    depthFormat: "depth24plus",
  }).plan!;
}

describe("renderer-derived lighting specialization", () => {
  it("keeps standalone generation complete and offers independent diagnostic toggles", () => {
    const complete = createStandardTextureVariantShader({
      ...features,
      shadowMap: true,
    }).code;
    expect(complete).toContain("if (kind == LIGHT_KIND_RECT_AREA)");
    expect(complete).toContain("fn sampleDirectionalShadowPcss(");
    const source = snapshot();
    expect(
      readStandardLightingSpecializationFeatures(
        key(
          withStandardLightingSpecializationPipelineKeys(source, {
            directionalFilter: false,
          }),
        ).split("|"),
      ),
    ).toEqual({ lightKindMask: 3 });
    expect(
      readStandardLightingSpecializationFeatures(
        key(
          withStandardLightingSpecializationPipelineKeys(source, {
            lightClasses: false,
          }),
        ).split("|"),
      ),
    ).toEqual({ fixedDirectionalShadowFilter: 1 });
    expect(
      withStandardLightingSpecializationPipelineKeys(source, {
        lightClasses: false,
        directionalFilter: false,
      }),
    ).toBe(source);
  });

  it("specializes a bare standard key without changing its default render state", () => {
    const initial = snapshot();
    const source = {
      ...initial,
      meshDraws: initial.meshDraws.map((draw) => ({
        ...draw,
        receivesShadow: false,
        batchKey: { ...draw.batchKey, pipelineKey: "standard" },
        sortKey: { ...draw.sortKey, pipelineKey: "standard" },
      })),
    };
    const specialized = withStandardLightingSpecializationPipelineKeys(source);
    expect(key(specialized)).toBe(
      "standard|standard-light-mask-3|opaque|back|less|none",
    );
    expect(pipeline(specialized).descriptor.primitive).toEqual(
      pipeline(source).descriptor.primitive,
    );
    expect(pipeline(specialized).descriptor.depthStencil).toEqual(
      pipeline(source).descriptor.depthStencil,
    );
    expect(
      withStandardLightingSpecializationPipelineKeys(source, {
        lightClasses: false,
        directionalFilter: false,
      }),
    ).toBe(source);
  });

  it("changes actual pipeline cache keys when a light class appears or a filter changes", () => {
    const source = snapshot();
    const initial = withStandardLightingSpecializationPipelineKeys(source);
    const point = withStandardLightingSpecializationPipelineKeys({
      ...initial,
      lights: [...initial.lights, light("point", 4)],
    });
    expect(pipeline(point).cacheKey).not.toBe(pipeline(initial).cacheKey);
    const back = withStandardLightingSpecializationPipelineKeys({
      ...point,
      lights: source.lights,
    });
    expect(pipeline(back).cacheKey).toBe(pipeline(initial).cacheKey);
    for (const filter of [0, 2]) {
      const next = withStandardLightingSpecializationPipelineKeys(
        snapshot(filter),
      );
      expect(pipeline(next).cacheKey).not.toBe(pipeline(initial).cacheKey);
    }
    const editedColor = withStandardLightingSpecializationPipelineKeys({
      ...initial,
      lights: initial.lights.map((entry) => ({ ...entry, intensity: 8 })),
    });
    expect(pipeline(editedColor).cacheKey).toBe(pipeline(initial).cacheKey);
    expect(key(source)).toBe("standard|shadowMap|opaque|back|less|none");
    expect(initial.shadowCasterDraws).toBe(source.shadowCasterDraws);
    expect(initial.transforms).toBe(source.transforms);
  });

  it("retains dynamic filtering for ambiguous owners, cascades, spots and mixed requests", () => {
    for (const source of [
      {
        ...snapshot(),
        lights: [...snapshot().lights, light("directional", 9)],
      },
      {
        ...snapshot(),
        shadowRequests: snapshot().shadowRequests.map((r) => ({
          ...r,
          cascadeCount: 2,
        })),
      },
      {
        ...snapshot(),
        shadowRequests: snapshot().shadowRequests.map((r) => ({
          ...r,
          lightKind: "spot" as const,
        })),
      },
      {
        ...snapshot(),
        shadowRequests: [
          ...snapshot().shadowRequests,
          { ...snapshot().shadowRequests[0]!, shadowId: 9 },
        ],
      },
      snapshot(NaN),
    ]) {
      expect(
        readStandardLightingSpecializationFeatures(
          key(withStandardLightingSpecializationPipelineKeys(source)).split(
            "|",
          ),
        ),
      ).not.toHaveProperty("fixedDirectionalShadowFilter");
    }
  });

  it("removes unreachable light classes while restoring area layouts when an area light appears", () => {
    const source = withStandardLightingSpecializationPipelineKeys(snapshot());
    expect(pipeline(source).descriptor.fragment).toMatchObject({
      moduleLabel: expect.stringContaining("light-mask-3"),
    });
    const code = createStandardTextureVariantShader({
      ...features,
      shadowMap: true,
      lightKindMask: 3,
    }).code;
    expect(code).toContain("if (kind == LIGHT_KIND_AMBIENT)");
    expect(code).toContain("if (kind == LIGHT_KIND_DIRECTIONAL)");
    for (const token of [
      "if (kind == LIGHT_KIND_POINT)",
      "if (kind == LIGHT_KIND_SPOT)",
      "if (kind == LIGHT_KIND_RECT_AREA)",
      "fn evaluateAreaLight(",
      "fn ltcEvaluateRect(",
    ])
      expect(code).not.toContain(token);
    expect(standardShaderUsesAreaLightLtc(key(source))).toBe(false);
    const area = withStandardLightingSpecializationPipelineKeys({
      ...source,
      lights: [...source.lights, light("rect-area", 5)],
    });
    expect(standardShaderUsesAreaLightLtc(key(area))).toBe(true);
    const full = createStandardTextureVariantShader({
      ...features,
      lightKindMask: 35,
    }).code;
    expect(full).toContain("if (kind == LIGHT_KIND_RECT_AREA)");
    expect(full).toContain("fn evaluateAreaLight(");
    expect(
      standardShaderUsesAreaLightLtc("standard|opaque|back|less|none"),
    ).toBe(true);
  });

  it("emits only the selected directional filter without changing projection or bias guards", () => {
    for (const filter of [0, 1, 2] as const) {
      const shader = createStandardTextureVariantShader({
        ...features,
        shadowMap: true,
        fixedDirectionalShadowFilter: filter,
      });
      expect(shader.code).toContain(`let filterType = ${filter}u;`);
      expect(shader.code).toContain("if (abs(shadowPosition.w) <= 0.00001)");
      expect(shader.code).toContain("if (projectionDistance > 0.0)");
      expect(shader.code).toContain("clampedShadowDepth - depthBias");
      expect(shader.code).toContain("rawVisibility != rawVisibility");
      expect(shader.code).toContain(
        "mix(1.0 - shadowStrengthValue, 1.0, visibility)",
      );
      expect(shader.code.includes("fn sampleDirectionalShadowPcss(")).toBe(
        filter === 2,
      );
      expect(shader.code.includes("fn sampleDirectionalShadowPcfSoft(")).toBe(
        filter === 1,
      );
      // PCSS keeps its existing hard-depth fallback through PCF3x3.
      expect(shader.code.includes("fn sampleDirectionalShadowPcf3x3(")).toBe(
        filter !== 1,
      );
    }
  });

  it("preserves general extension and alternate shadow paths instead of specializing their filter", () => {
    for (const extra of [
      { cascadedShadowMap: true },
      { spotShadowMap: true },
      { pointShadowMap: true },
      { directionalPointShadowMap: true },
    ]) {
      const original = createStandardTextureVariantShader({
        ...features,
        shadowMap: true,
        ...extra,
      });
      const candidate = createStandardTextureVariantShader({
        ...features,
        shadowMap: true,
        ...extra,
        fixedDirectionalShadowFilter: 1,
      });
      expect(candidate.code).toBe(original.code);
    }
    const shader = createStandardTextureVariantShader({
      ...features,
      shadowMap: true,
      clearcoat: true,
      sheen: true,
      iridescence: true,
      lightKindMask: 3,
      fixedDirectionalShadowFilter: 1,
    });
    expect(shader.code).toContain("clearcoatSpecular");
    expect(shader.code).toContain("standardIridescenceFresnel");
    expect(shader.code).toContain("if (kind == LIGHT_KIND_DIRECTIONAL)");
  });
});
