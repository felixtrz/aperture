import { AssetRegistry } from "@aperture-engine/simulation";
import { renderWebGpuAppFrame } from "../../packages/webgpu/src/app/frame-loop.js";
import { createWebGpuAppResourceCache } from "../../packages/webgpu/src/app/resource-cache.js";
import type { WebGpuApp } from "../../packages/webgpu/src/app/app.js";
import type { StandardFrameShadowReceiverResources } from "../../packages/webgpu/src/materials/standard/standard-frame-resources.js";
import { describe, expect, it } from "vitest";
import { withStandardShadowPipelineKeys } from "../../packages/webgpu/src/materials/standard/standard-app-pipeline-keys.js";
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

describe("renderer-derived first shadow owner", () => {
  it("derives the first directional only from the actual ordered tuple", () => {
    const unit = snapshot();
    const canonical = withStandardShadowPipelineKeys({
      ...unit,
      lights: [light("directional", 3), light("ambient", 2)],
    });
    const canonicalDerived = withStandardLightingSpecializationPipelineKeys(
      canonical,
      { knownLightLayout: true, knownShadowOwner: true },
    );
    expect(key(canonicalDerived)).toContain("standard-light-layout-2-1_0");
    expect(key(canonicalDerived)).toContain("standard-single-shadow-owner-0");
    expect(
      functionBody(
        resolveStandardShaderForBatchKey(
          canonicalDerived.meshDraws[0]!.batchKey,
        ).code,
        "singleShadowLightIndex",
      ),
    ).toContain("return 0u;");
    const scene = snapshot();
    const candidate = withStandardLightingSpecializationPipelineKeys(scene, {
      knownLightLayout: true,
      knownShadowOwner: true,
    });
    expect(key(candidate)).toContain("standard-single-shadow-owner-1");
    expect(
      readStandardLightingSpecializationFeatures(key(candidate).split("|"))
        .fixedSingleShadowLightIndex,
    ).toBe(1);
    const numeric = withStandardLightingSpecializationPipelineKeys(
      {
        ...candidate,
        lights: candidate.lights.map((entry) => ({ ...entry, intensity: 2 })),
      },
      { knownLightLayout: true, knownShadowOwner: true },
    );
    expect(pipeline(numeric).cacheKey).toBe(pipeline(candidate).cacheKey);
    const reordered = withStandardLightingSpecializationPipelineKeys(
      { ...candidate, lights: [...candidate.lights].reverse() },
      { knownLightLayout: true, knownShadowOwner: true },
    );
    expect(key(reordered)).toContain("standard-single-shadow-owner-0");
    expect(pipeline(reordered).cacheKey).not.toBe(pipeline(candidate).cacheKey);
    const externalFilter = withStandardLightingSpecializationPipelineKeys(
      scene,
      {
        knownLightLayout: true,
        knownShadowOwner: true,
        directionalFilter: false,
      },
    );
    expect(key(externalFilter)).not.toContain("standard-directional-filter-");
    expect(key(externalFilter)).toContain("standard-single-shadow-owner-1");
  });
  it("keeps the count guard and precise no-owner fallback with all other shadow math unchanged", () => {
    const common = {
      ...features,
      lightKindMask: 3,
      knownLightKindLayout: [0, 1] as const,
      shadowMap: true,
      fixedDirectionalShadowFilter: 1 as const,
    };
    const baseline = createStandardTextureVariantShader(common).code;
    const candidate = createStandardTextureVariantShader({
      ...common,
      fixedSingleShadowLightIndex: 1,
    }).code;
    const owner = functionBody(candidate, "singleShadowLightIndex");
    expect(owner).toContain("if (1u < lightCount())");
    expect(owner).toContain("return 1u;");
    expect(owner).toContain("return lightCount();");
    expect(owner).not.toContain("for (var directionalIndex");
    expect(owner).not.toContain("for (var spotIndex");
    for (const name of [
      "directionalShadowStrengthValue",
      "directionalShadowDepthBiasValue",
      "directionalShadowNormalBiasValue",
      "directionalShadowFilterRadiusValue",
      "sampleSpotShadowFactorWithMatrixBaseAndStrength",
      "lightCount",
      "fs_main",
    ]) {
      expect(functionBody(candidate, name)).toBe(functionBody(baseline, name));
    }
    const emptyOwner = createStandardTextureVariantShader({
      ...common,
      lightKindMask: 1,
      knownLightKindLayout: [0],
      fixedSingleShadowLightIndex: -1,
    }).code;
    expect(functionBody(emptyOwner, "singleShadowLightIndex")).toContain(
      "return lightCount();",
    );
    expect(functionBody(emptyOwner, "singleShadowLightIndex")).not.toContain(
      "for (",
    );
    expect(functionBody(emptyOwner, "fs_main")).toContain(
      "if (0u < lightCount())",
    );
  });
  it("retains existing scans for every unsupported or malformed owner route", () => {
    const common = {
      ...features,
      lightKindMask: 3,
      knownLightKindLayout: [0, 1] as const,
      shadowMap: true,
    };
    for (const owner of [-2, 0, 2, 8, NaN]) {
      expect(
        functionBody(
          createStandardTextureVariantShader({
            ...common,
            fixedSingleShadowLightIndex: owner,
          }).code,
          "singleShadowLightIndex",
        ),
      ).toContain("for (var directionalIndex");
    }
    for (const flag of [
      "cascadedShadowMap",
      "pointShadowMap",
      "directionalPointShadowMap",
      "spotShadowMap",
      "clusteredLocalLights",
      "clusteredLocalLightCookies",
      "clusteredLocalLightShadowCookies",
      "clusteredLocalLightArrayCookies",
      "clusteredLocalLightCubeCookies",
      "clusteredLocalLightArrayShadows",
      "clusteredLocalLightPointArrayShadows",
    ] as const) {
      const code = createStandardTextureVariantShader({
        ...common,
        fixedSingleShadowLightIndex: 1,
        [flag]: true,
      }).code;
      if (code.includes("fn singleShadowLightIndex("))
        expect(functionBody(code, "singleShadowLightIndex")).toContain(
          "for (var directionalIndex",
        );
    }
    for (const token of [
      "standard-single-shadow-owner-0",
      "standard-single-shadow-owner-none",
      "standard-single-shadow-owner-8",
      "standard-single-shadow-owner-01",
    ]) {
      expect(
        readStandardLightingSpecializationFeatures([
          "shadowMap",
          "standard-light-mask-3",
          "standard-light-layout-2-0_1",
          token,
        ]).fixedSingleShadowLightIndex,
      ).toBeUndefined();
    }
    for (const flag of [
      "clusteredLocalLights",
      "clusteredLocalLightCookies",
      "clusteredLocalLightShadowCookies",
      "clusteredLocalLightArrayCookies",
      "clusteredLocalLightCubeCookies",
      "clusteredLocalLightArrayShadows",
      "clusteredLocalLightPointArrayShadows",
    ]) {
      const tokens = [
        "standard",
        "shadowMap",
        "standard-light-mask-3",
        "standard-light-layout-2-0_1",
        "standard-single-shadow-owner-1",
        flag,
        "opaque",
        "back",
        "less",
        "none",
      ];
      expect(
        readStandardLightingSpecializationFeatures(tokens)
          .fixedSingleShadowLightIndex,
      ).toBeUndefined();
      const decoded = resolveStandardShaderForBatchKey({
        ...snapshot().meshDraws[0]!.batchKey,
        pipelineKey: tokens.join("|"),
      });
      expect(functionBody(decoded.code, "singleShadowLightIndex")).toContain(
        "for (var directionalIndex",
      );
    }
    const source = {
      ...snapshot(),
      lights: [light("ambient", 2), light("directional", 3), light("spot", 4)],
    };
    expect(
      key(
        withStandardLightingSpecializationPipelineKeys(source, {
          knownLightLayout: true,
          knownShadowOwner: true,
        }),
      ),
    ).not.toContain("standard-single-shadow-owner-");
    expect(
      createStandardTextureVariantShader({ ...features, shadowMap: true }).code,
    ).toContain("for (var directionalIndex");
  });
});

describe("shadow owner and general shader fallback", () => {
  it("preserves every actual seven-flag fallback and strips stale owner hints", () => {
    for (const flag of [
      "clusteredLocalLights",
      "clusteredLocalLightCookies",
      "clusteredLocalLightShadowCookies",
      "clusteredLocalLightArrayCookies",
      "clusteredLocalLightCubeCookies",
      "clusteredLocalLightArrayShadows",
      "clusteredLocalLightPointArrayShadows",
    ] as const) {
      const scene = snapshot();
      const draw = scene.meshDraws[0]!;
      const pipelineKey = `standard|standard-light-mask-3|standard-directional-filter-1|standard-light-layout-2-0_1|standard-single-shadow-owner-1|clusteredLocalLights|${flag}|shadowMap|opaque|back|less|none`;
      const source = {
        ...scene,
        meshDraws: [
          {
            ...draw,
            batchKey: { ...draw.batchKey, pipelineKey },
            sortKey: { ...draw.sortKey, pipelineKey },
          },
        ],
      };
      const derived = withStandardLightingSpecializationPipelineKeys(source, {
        knownLightLayout: true,
        knownShadowOwner: true,
      });
      for (const prefix of [
        "standard-light-mask-",
        "standard-directional-filter-",
        "standard-light-layout-",
        "standard-single-shadow-owner-",
      ])
        expect(key(derived)).not.toContain(prefix);
      expect(
        readStandardLightingSpecializationFeatures(pipelineKey.split("|")),
      ).toEqual({});
      expect(standardShaderUsesAreaLightLtc(key(derived))).toBe(true);
      expect(derived.meshDraws[0]!.sortKey.pipelineKey).toBe(key(derived));
      const baseline = createStandardTextureVariantShader({
        ...features,
        shadowMap: true,
        clusteredLocalLights: true,
        [flag]: true,
      }).code;
      expect(
        createStandardTextureVariantShader({
          ...features,
          shadowMap: true,
          clusteredLocalLights: true,
          [flag]: true,
          lightKindMask: 3,
          knownLightKindLayout: [0, 1],
          fixedDirectionalShadowFilter: 1,
          fixedSingleShadowLightIndex: 1,
        }).code,
      ).toBe(baseline);
    }
  });

  it("changes only the owner function for canonical and all ordinary tuple shapes", () => {
    for (const layout of [
      [1, 0],
      [0, 1],
      [0],
      [1],
      [1, 1],
      [0, 1, 0],
      [0, 0],
      [0, 1, 0, 1, 0, 1, 0, 1],
    ] as const) {
      for (const extension of [
        {},
        { clearcoat: true },
        { transmission: true },
        { sheen: true },
        { iridescence: true },
        { clearcoat: true, transmission: true, sheen: true, iridescence: true },
      ]) {
        for (const filter of [0, 1, 2] as const) {
          const common = {
            ...features,
            ...extension,
            shadowMap: true,
            lightKindMask: layout.reduce<number>(
              (mask, kind) => mask | (1 << kind),
              0,
            ),
            knownLightKindLayout: layout,
            fixedDirectionalShadowFilter: filter,
          };
          const baseline = createStandardTextureVariantShader(common).code;
          const candidate = createStandardTextureVariantShader({
            ...common,
            fixedSingleShadowLightIndex: layout.findIndex(
              (kind: number) => kind === 1,
            ),
          }).code;
          expect(
            candidate.replace(
              functionBody(candidate, "singleShadowLightIndex"),
              functionBody(baseline, "singleShadowLightIndex"),
            ),
          ).toBe(baseline);
        }
      }
    }
  });
});

describe("external shadow receiver specialization boundary", () => {
  it("collects the complete general shader for borrowed receiver resources and restores ordinary cache keys", async () => {
    const prefixes = [
      "standard-light-mask-",
      "standard-directional-filter-",
      "standard-light-layout-",
      "standard-single-shadow-owner-",
    ];
    // No view is authored: the real collector derives keys and then stops
    // before creating GPU resources. These objects are CPU test descriptors.
    const app = { initialization: { device: {} } } as WebGpuApp;
    const receiver = {
      shadowKind: "directional",
      depthTextureResources: { resources: [] },
    } as unknown as StandardFrameShadowReceiverResources;
    const cache = createWebGpuAppResourceCache(false);
    const sourceAssets = new AssetRegistry();
    const general = createStandardTextureVariantShader({
      ...features,
      shadowMap: true,
    }).code;
    for (const kinds of [
      ["ambient"],
      ["directional", "ambient"],
      ["ambient", "directional"],
    ] as const) {
      const source = {
        ...snapshot(),
        lights: kinds.map((kind, index) => light(kind, index + 2)),
      };
      const derived = withStandardLightingSpecializationPipelineKeys(source, {
        knownLightLayout: true,
        knownShadowOwner: true,
      });
      const before = await renderWebGpuAppFrame({ app, sourceAssets }, cache, {
        snapshot: derived,
      });
      expect(before.ok).toBe(false);
      expect(
        before.diagnostics.some(
          (d) =>
            typeof d === "object" &&
            d !== null &&
            "code" in d &&
            d.code === "webGpuApp.emptySnapshot",
        ),
      ).toBe(true);
      const ordinaryKey = key(before.snapshot);
      expect(ordinaryKey).toContain("standard-light-layout-");
      const ordinaryCacheKey = pipeline(before.snapshot).cacheKey;
      const external = await renderWebGpuAppFrame(
        { app, sourceAssets },
        cache,
        {
          snapshot: before.snapshot,
          standardMaterialShadowReceiverResources: receiver,
        },
      );
      expect(external.ok).toBe(false);
      expect(
        external.diagnostics.some(
          (d) =>
            typeof d === "object" &&
            d !== null &&
            "code" in d &&
            d.code === "webGpuApp.emptySnapshot",
        ),
      ).toBe(true);
      for (const prefix of prefixes)
        expect(key(external.snapshot)).not.toContain(prefix);
      expect(external.snapshot.meshDraws[0]!.sortKey.pipelineKey).toBe(
        key(external.snapshot),
      );
      expect(standardShaderUsesAreaLightLtc(key(external.snapshot))).toBe(true);
      expect(
        readStandardLightingSpecializationFeatures(
          key(external.snapshot).split("|"),
        ),
      ).toEqual({});
      expect(
        resolveStandardShaderForBatchKey(
          external.snapshot.meshDraws[0]!.batchKey,
        ).code,
      ).toBe(general);
      expect(pipeline(external.snapshot).cacheKey).not.toBe(ordinaryCacheKey);
      const restored = await renderWebGpuAppFrame(
        { app, sourceAssets },
        cache,
        {
          snapshot: source,
        },
      );
      expect(key(restored.snapshot)).toBe(ordinaryKey);
      expect(pipeline(restored.snapshot).cacheKey).toBe(ordinaryCacheKey);
      expect(key(source)).not.toContain("standard-light-layout-");
    }
  });
});
