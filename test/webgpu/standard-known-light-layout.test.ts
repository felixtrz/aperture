import { describe, expect, it } from "vitest";
import { withStandardClusteredLocalLightPipelineKeys } from "../../packages/webgpu/src/materials/standard/standard-app-pipeline-keys.js";
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
import {
  createStandardPipelineDescriptorPlan,
  resolveStandardShaderForBatchKey,
} from "../../packages/webgpu/src/materials/standard/standard-pipeline-descriptor.js";
import { createStandardTextureVariantShader } from "../../packages/webgpu/src/materials/standard/standard-shader.js";

import { packLightPackets } from "../../packages/webgpu/src/lighting/light-packing.js";
import {
  CLUSTERED_LOCAL_LIGHT_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_SHADOW_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_ARRAY_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_CUBE_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_ARRAY_SHADOW_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_POINT_ARRAY_SHADOW_PIPELINE_FEATURE,
} from "../../packages/webgpu/src/lighting/local-light-cluster-constants.js";
import { applyStandardShaderSpecialization } from "../../packages/webgpu/src/materials/standard/standard-shader-specialization.js";
import { createStandardPipelineShaderFeaturePlan } from "../../packages/webgpu/src/materials/standard/standard-pipeline-descriptor.js";

const clusteredFlags = [
  CLUSTERED_LOCAL_LIGHT_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_SHADOW_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_ARRAY_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_CUBE_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_ARRAY_SHADOW_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_POINT_ARRAY_SHADOW_PIPELINE_FEATURE,
] as const;

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

function functionBody(code: string, name: string): string {
  const start = code.indexOf(`fn ${name}(`);
  expect(start).toBeGreaterThanOrEqual(0);
  const opening = code.indexOf("{", start);
  let depth = 0;
  for (let index = opening; index < code.length; index++) {
    if (code[index] === "{") depth++;
    if (code[index] === "}" && --depth === 0)
      return code.slice(start, index + 1);
  }
  throw new Error("Missing generated function end");
}

function loopBody(code: string): string {
  const main = functionBody(code, "fs_main");
  const start = main.indexOf("  for (var lightIndex = 0u;");
  expect(start).toBeGreaterThanOrEqual(0);
  const opening = main.indexOf("{", start);
  let depth = 0;
  for (let index = opening; index < main.length; index++) {
    if (main[index] === "{") depth++;
    if (main[index] === "}" && --depth === 0)
      return main.slice(opening + 1, index);
  }
  throw new Error("Missing generated loop end");
}

function branchTerm(body: string, name: string): string {
  const start = body.indexOf(`if (kind == LIGHT_KIND_${name}) {`);
  expect(start).toBeGreaterThanOrEqual(0);
  const opening = body.indexOf("{", start);
  let depth = 0;
  for (let index = opening; index < body.length; index++) {
    if (body[index] === "{") depth++;
    if (body[index] === "}" && --depth === 0)
      return body.slice(opening + 1, index);
  }
  throw new Error("Missing generated term end");
}

describe("renderer-derived ordered light layout", () => {
  it("uses the exact packet order and invalidates count/kind-order keys", () => {
    const scene = {
      ...snapshot(),
      lights: [
        light("directional", 3),
        light("ambient", 2),
        light("directional", 6),
      ],
    };
    const initial = withStandardLightingSpecializationPipelineKeys(scene, {
      knownLightLayout: true,
    });
    const packed = packLightPackets(scene);
    expect(
      Array.from(
        { length: packed.count },
        (_, index) => packed.metadata[index * packed.metadataStride],
      ),
    ).toEqual([1, 0, 1]);
    expect(key(initial)).toContain("standard-light-layout-3-1_0_1");
    expect(initial.meshDraws[0]!.sortKey.pipelineKey).toBe(key(initial));
    expect(scene.meshDraws[0]!.batchKey.pipelineKey).not.toContain(
      "standard-light-layout-",
    );
    const numeric = withStandardLightingSpecializationPipelineKeys(
      {
        ...initial,
        lights: initial.lights.map((entry) => ({
          ...entry,
          intensity: 8,
          color: [0.5, 0.4, 0.3, 1] as const,
        })),
      },
      { knownLightLayout: true },
    );
    expect(pipeline(numeric).cacheKey).toBe(pipeline(initial).cacheKey);
    const reorder = withStandardLightingSpecializationPipelineKeys(
      {
        ...initial,
        lights: [scene.lights[1]!, scene.lights[0]!, scene.lights[2]!],
      },
      { knownLightLayout: true },
    );
    expect(pipeline(reorder).cacheKey).not.toBe(pipeline(initial).cacheKey);
    const count = withStandardLightingSpecializationPipelineKeys(
      {
        ...initial,
        lights: [...scene.lights, light("ambient", 7)],
      },
      { knownLightLayout: true },
    );
    expect(pipeline(count).cacheKey).not.toBe(pipeline(initial).cacheKey);
  });

  it("retains runtime metadata guards, indices, owner scan and extension ordering", () => {
    for (const extension of [
      {},
      { clearcoat: true },
      { transmission: true },
      { sheen: true },
      { iridescence: true },
      { clearcoat: true, transmission: true, sheen: true, iridescence: true },
    ]) {
      const common = {
        ...features,
        ...extension,
        shadowMap: true,
        lightKindMask: 3,
        fixedDirectionalShadowFilter: 1 as const,
      };
      const baseline = createStandardTextureVariantShader(common).code;
      const candidate = createStandardTextureVariantShader({
        ...common,
        knownLightKindLayout: [1, 0, 1],
      }).code;
      const main = functionBody(candidate, "fs_main");
      expect(main).not.toContain("for (var lightIndex = 0u;");
      expect(main).not.toContain("let kind = lightKind(lightIndex)");
      const original = loopBody(baseline);
      const directional = branchTerm(original, "DIRECTIONAL");
      const ambient = branchTerm(original, "AMBIENT");
      const expected = [
        `  if (0u < lightCount()) {${directional.replace(/\blightIndex\b/gu, "0u")}  }`,
        `  if (1u < lightCount()) {${ambient.replace(/\blightIndex\b/gu, "1u")}  }`,
        `  if (2u < lightCount()) {${directional.replace(/\blightIndex\b/gu, "2u")}  }`,
      ].join("\n");
      expect(main).toContain(expected);
      expect(main).not.toContain("if (3u < lightCount())");
      expect(functionBody(candidate, "lightCount")).toBe(
        functionBody(baseline, "lightCount"),
      );
      expect(functionBody(candidate, "singleShadowLightIndex")).toBe(
        functionBody(baseline, "singleShadowLightIndex"),
      );
    }
    const noShadow = createStandardTextureVariantShader({
      ...features,
      lightKindMask: 1,
      knownLightKindLayout: [0],
    }).code;
    expect(functionBody(noShadow, "fs_main")).toContain(
      "if (0u < lightCount())",
    );
    expect(functionBody(noShadow, "lightCount")).toContain(
      "arrayLength(&lightMetadata)",
    );
  });

  it("keeps conservative source and key fallbacks", () => {
    const withoutMask = createStandardTextureVariantShader({
      ...features,
      knownLightKindLayout: [0, 1],
    }).code;
    expect(functionBody(withoutMask, "fs_main")).toContain(
      "for (var lightIndex = 0u;",
    );
    expect(
      readStandardLightingSpecializationFeatures([
        "standard-light-layout-2-0_1",
      ]).knownLightKindLayout,
    ).toBeUndefined();
    const layoutOnly = withStandardLightingSpecializationPipelineKeys(
      snapshot(),
      { knownLightLayout: true, lightClasses: false },
    );
    expect(key(layoutOnly)).not.toContain("standard-light-layout-");
    const maximum = withStandardLightingSpecializationPipelineKeys(
      {
        ...snapshot(),
        lights: Array.from({ length: 8 }, (_, index) =>
          light("ambient", index),
        ),
      },
      { knownLightLayout: true },
    );
    expect(key(maximum)).toContain("standard-light-layout-8-0_0_0_0_0_0_0_0");
    const standalone = createStandardTextureVariantShader(features).code;
    expect(functionBody(standalone, "fs_main")).toContain(
      "for (var lightIndex = 0u;",
    );
    for (const lights of [
      [],
      [light("environment", 1)],
      [light("ambient", 1), light("environment", 2), light("directional", 3)],
      [light("ambient", 1), light("point", 2)],
      [light("ambient", 1), light("spot", 2)],
      [light("ambient", 1), light("rect-area", 2)],
      Array.from({ length: 9 }, (_, index) => light("ambient", index)),
    ]) {
      const result = withStandardLightingSpecializationPipelineKeys(
        { ...snapshot(), lights },
        { knownLightLayout: true },
      );
      expect(key(result)).not.toContain("standard-light-layout-");
    }
    for (const token of [
      "standard-light-layout-2-0",
      "standard-light-layout-01-0",
      "standard-light-layout-9-0",
      "standard-light-layout-1-4",
      "standard-light-layout-3-0_4_1",
      "standard-light-layout-2-0_2",
      "standard-light-layout-2-0_1_0",
    ]) {
      expect(
        readStandardLightingSpecializationFeatures([token])
          .knownLightKindLayout,
      ).toBeUndefined();
    }
    expect(
      readStandardLightingSpecializationFeatures([
        "standard-light-layout-2-0_1",
        "standard-light-layout-2-1_0",
      ]).knownLightKindLayout,
    ).toBeUndefined();
    expect(
      readStandardLightingSpecializationFeatures([
        "standard-light-layout-2-0_1",
        "standard-light-mask-7",
      ]).knownLightKindLayout,
    ).toBeUndefined();
    expect(
      readStandardLightingSpecializationFeatures([
        "standard-light-layout-2-0_1",
        "clusteredLocalLights",
      ]).knownLightKindLayout,
    ).toBeUndefined();
    for (const token of [
      "clusteredLocalLights",
      "clusteredLocalLightCookies",
      "clusteredLocalLightShadowCookies",
      "clusteredLocalLightArrayCookies",
      "clusteredLocalLightCubeCookies",
      "clusteredLocalLightArrayShadows",
      "clusteredLocalLightPointArrayShadows",
    ]) {
      const decoded = resolveStandardShaderForBatchKey({
        ...snapshot().meshDraws[0]!.batchKey,
        pipelineKey: `standard|standard-light-mask-3|standard-light-layout-2-0_1|${token}|opaque|back|less|none`,
      });
      expect(functionBody(decoded.code, "fs_main")).toContain(
        "for (var lightIndex = 0u;",
      );
    }
    const cluster = createStandardTextureVariantShader({
      ...features,
      lightKindMask: 3,
      knownLightKindLayout: [0, 1],
      clusteredLocalLights: true,
    }).code;
    expect(functionBody(cluster, "fs_main")).toContain(
      "for (var lightIndex = 0u;",
    );
    const initial = withStandardLightingSpecializationPipelineKeys(snapshot(), {
      knownLightLayout: true,
    });
    const off = withStandardLightingSpecializationPipelineKeys(initial);
    expect(key(off)).not.toContain("standard-light-layout-");
  });
});

describe("complete clustered fallback", () => {
  it("strips stale hints and keeps all seven actual decoded routes complete", () => {
    for (const flag of clusteredFlags) {
      const pipelineKey = `standard|standard-light-mask-3|standard-directional-filter-1|standard-light-layout-2-0_1|standard-single-shadow-owner-1|${flag}|shadowMap|clearcoat|opaque|back|less|none`;
      const before = snapshot();
      const draw = before.meshDraws[0]!;
      const scene = {
        ...before,
        meshDraws: [
          {
            ...draw,
            batchKey: { ...draw.batchKey, pipelineKey },
            sortKey: { ...draw.sortKey, pipelineKey },
          },
        ],
      };
      const cleaned = withStandardLightingSpecializationPipelineKeys(scene, {
        knownLightLayout: true,
      });
      for (const prefix of [
        "standard-light-mask-",
        "standard-directional-filter-",
        "standard-light-layout-",
        "standard-single-shadow-owner-",
      ]) {
        expect(key(cleaned)).not.toContain(prefix);
      }
      expect(key(cleaned)).toBe(
        `standard|${flag}|shadowMap|clearcoat|opaque|back|less|none`,
      );
      expect(cleaned.meshDraws[0]!.sortKey.pipelineKey).toBe(key(cleaned));
      expect(key(scene)).toBe(pipelineKey);
      expect(
        withStandardLightingSpecializationPipelineKeys(cleaned, {
          knownLightLayout: true,
        }),
      ).toBe(cleaned);
      expect(
        readStandardLightingSpecializationFeatures(pipelineKey.split("|")),
      ).toEqual({});
      expect(standardShaderUsesAreaLightLtc(pipelineKey)).toBe(true);
      const decoded = createStandardPipelineShaderFeaturePlan({
        ...draw.batchKey,
        pipelineKey,
      });
      expect(decoded.features[flag]).toBe(true);
      expect(decoded.features.lightKindMask).toBeUndefined();
      expect(decoded.features.knownLightKindLayout).toBeUndefined();
      expect(decoded.features.fixedDirectionalShadowFilter).toBeUndefined();
      const complete = resolveStandardShaderForBatchKey({
        ...draw.batchKey,
        pipelineKey: key(cleaned),
      });
      expect(decoded.shader.code).toBe(complete.code);
      expect(decoded.shader.code).toContain("fn evaluateAreaLight(");
      expect(decoded.shader.code).toContain("if (kind == LIGHT_KIND_SPOT)");
      expect(decoded.shader.code).toContain("@group(3) @binding(2)");
    }
  });

  it("keeps complete composed clustered routes unchanged by specialization hints", () => {
    for (const flag of clusteredFlags) {
      for (const extension of [
        {},
        { clearcoat: true },
        { transmission: true },
        { sheen: true },
        { iridescence: true },
        { clearcoat: true, transmission: true, sheen: true, iridescence: true },
      ]) {
        for (const shadow of [false, true]) {
          const actualFlags = createStandardPipelineShaderFeaturePlan({
            pipelineKey: `standard|clusteredLocalLights|${flag}|opaque|back|less|none`,
          }).features;
          const common = { ...actualFlags, ...extension, shadowMap: shadow };
          const baseline = createStandardTextureVariantShader(common).code;
          const candidate = createStandardTextureVariantShader({
            ...common,
            lightKindMask: 3,
            fixedDirectionalShadowFilter: 1,
            knownLightKindLayout: [0, 1],
          }).code;
          expect(candidate).toBe(baseline);
        }
      }
    }
  });

  it("returns fully composed source unchanged for even individual direct flags", () => {
    const source = createStandardTextureVariantShader({
      ...features,
      shadowMap: true,
      clusteredLocalLights: true,
    }).code;
    for (const flag of clusteredFlags) {
      expect(
        applyStandardShaderSpecialization(source, {
          ...features,
          [flag]: true,
          lightKindMask: 3,
          fixedDirectionalShadowFilter: 1,
          knownLightKindLayout: [0, 1],
        }),
      ).toBe(source);
    }
  });

  it("rederives after real automatic cluster flags and restores ordinary keys", () => {
    const ordinary = withStandardLightingSpecializationPipelineKeys(
      snapshot(),
      { knownLightLayout: true },
    );
    const local = {
      ...ordinary,
      transforms: new Float32Array([
        1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -4, 1,
      ]),
      lights: [
        ...ordinary.lights,
        ...Array.from({ length: 16 }, (_, index) =>
          light("point", 100 + index),
        ),
      ],
    };
    const initiallyDerived = withStandardLightingSpecializationPipelineKeys(
      local,
      { knownLightLayout: true },
    );
    expect(key(initiallyDerived)).toContain("standard-light-mask-7");
    const actualCluster =
      withStandardClusteredLocalLightPipelineKeys(initiallyDerived);
    expect(key(actualCluster)).toContain(
      CLUSTERED_LOCAL_LIGHT_PIPELINE_FEATURE,
    );
    expect(key(actualCluster)).toContain("standard-light-mask-7");
    const finalDerived = withStandardLightingSpecializationPipelineKeys(
      actualCluster,
      { knownLightLayout: true },
    );
    expect(key(finalDerived)).not.toContain("standard-light-mask-");
    expect(key(finalDerived)).not.toContain("standard-directional-filter-");
    expect(standardShaderUsesAreaLightLtc(key(finalDerived))).toBe(true);
    // A new ECS extraction creates material keys without previous cluster flags.
    const restored = withStandardLightingSpecializationPipelineKeys(
      snapshot(),
      { knownLightLayout: true },
    );
    expect(key(restored)).toBe(key(ordinary));
    expect(pipeline(restored).cacheKey).toBe(pipeline(ordinary).cacheKey);
  });
});
