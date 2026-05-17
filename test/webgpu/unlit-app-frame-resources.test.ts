import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  assetHandleKey,
  createMaterialHandle,
  createMeshHandle,
  createSamplerHandle,
  createTextureHandle,
} from "@aperture-engine/simulation";
import {
  createMatcapMaterialAsset,
  createSamplerAsset,
  createStandardMaterialAsset,
  createTextureAsset,
  type RenderSnapshot,
} from "@aperture-engine/render";
import {
  createMatcapMaterialBindGroupLayoutPlan,
  createOrReuseMatcapAppFrameResources,
  createOrReuseStandardAppFrameResources,
  createOrReuseUnlitAppFrameResources,
  createPreparedMatcapMaterialCache,
  createPreparedMeshGpuResourceCache,
  createPreparedScalarStandardMaterialCache,
  createPreparedScalarUnlitMaterialCache,
  createStandardMaterialBindGroupLayoutPlan,
  createUnlitBindGroupLayoutMetadata,
  createUnlitMaterialAsset,
  type MatcapMaterialBindGroupLayoutResource,
  type StandardMaterialBindGroupLayoutResource,
  type UnlitBindGroupLayoutResource,
  type WebGpuBufferDeviceLike,
} from "@aperture-engine/webgpu";

describe("unlit app frame-resource fallback diagnostics", () => {
  it("emits an app fallback diagnostic when prepared material layout is missing", () => {
    const registry = new AssetRegistry();
    const material = createMaterialHandle("missing-layout");

    registry.register(material);
    const entry = registry.markReady(material, createUnlitMaterialAsset());
    const result = createOrReuseUnlitAppFrameResources({
      device: {},
      cache: { current: null },
      mesh: null,
      meshHandle: createMeshHandle("missing"),
      meshKey: "mesh:missing@1",
      material: required(entry.asset),
      materialHandle: material,
      materialKey: `${assetHandleKey(material)}@${entry.version}`,
      sourceMaterialKey: assetHandleKey(material),
      pipelineKey: "unlit|opaque|back|less|none",
      preparedMeshes: createPreparedMeshGpuResourceCache(),
      preparedScalarMaterials: createPreparedScalarUnlitMaterialCache(),
      assets: registry,
      textureSamplerDependencies: emptyTextureSamplerDependencies(),
      viewUniforms: emptyViewUniforms(),
      worldTransforms: emptyTransforms(),
      layouts: [],
      reuse: reuseCounters(),
    });

    expect(fallbackDiagnostic(result)).toMatchObject({
      code: "webGpuApp.preparedMaterialFallback",
      materialFamily: "unlit",
      materialKey: "material:missing-layout",
      reason: "missing-layout",
      diagnostics: [
        {
          code: "preparedScalarUnlitMaterial.missingLayout",
          materialKey: "material:missing-layout",
        },
      ],
    });
  });

  it("emits an app fallback diagnostic when prepared texture resources are missing", () => {
    const registry = new AssetRegistry();
    const material = createMaterialHandle("missing-texture-resource");
    const texture = createTextureHandle("albedo");
    const sampler = createSamplerHandle("linear");

    registry.register(material);
    registry.register(texture);
    registry.register(sampler);
    registry.markReady(
      texture,
      createTextureAsset({
        label: "Albedo",
        dimension: "2d",
        width: 1,
        height: 1,
        format: "rgba8unorm",
        colorSpace: "srgb",
        semantic: "base-color",
      }),
    );
    registry.markReady(sampler, createSamplerAsset());
    const entry = registry.markReady(
      material,
      createUnlitMaterialAsset({
        baseColorTexture: { texture, sampler },
      }),
    );

    const result = createOrReuseUnlitAppFrameResources({
      device: deviceWithBuffers(),
      cache: { current: null },
      mesh: null,
      meshHandle: createMeshHandle("missing"),
      meshKey: "mesh:missing@1",
      material: required(entry.asset),
      materialHandle: material,
      materialKey: `${assetHandleKey(material)}@${entry.version}`,
      sourceMaterialKey: assetHandleKey(material),
      pipelineKey: "unlit|opaque|back|less|textured",
      preparedMeshes: createPreparedMeshGpuResourceCache(),
      preparedScalarMaterials: createPreparedScalarUnlitMaterialCache(),
      assets: registry,
      textureSamplerDependencies: emptyTextureSamplerDependencies(),
      viewUniforms: emptyViewUniforms(),
      worldTransforms: emptyTransforms(),
      layouts: [materialLayout()],
      reuse: reuseCounters(),
    });

    expect(fallbackDiagnostic(result)).toMatchObject({
      code: "webGpuApp.preparedMaterialFallback",
      materialFamily: "unlit",
      materialKey: "material:missing-texture-resource",
      reason: "missing-prepared-dependency",
      diagnostics: [
        {
          code: "unlitBindGroupResource.missingTextureResource",
          resourceKey: "texture:albedo",
        },
        {
          code: "unlitBindGroupResource.missingSamplerResource",
          resourceKey: "sampler:linear",
        },
      ],
    });
  });

  it("emits a Matcap fallback diagnostic when prepared material layout is missing", () => {
    const registry = new AssetRegistry();
    const material = createMaterialHandle("matcap-missing-layout");
    const texture = createTextureHandle("matcap-layout");
    const sampler = createSamplerHandle("matcap-layout-sampler");

    registry.register(material);
    registry.register(texture);
    registry.register(sampler);
    registry.markReady(texture, textureAsset("MatcapLayoutTexture"));
    registry.markReady(sampler, createSamplerAsset());
    const entry = registry.markReady(
      material,
      createMatcapMaterialAsset({
        matcapTexture: { texture, sampler },
      }),
    );

    const result = createOrReuseMatcapAppFrameResources({
      device: {},
      cache: { current: null },
      mesh: null,
      meshHandle: createMeshHandle("missing"),
      meshKey: "mesh:missing@1",
      material: required(entry.asset),
      materialHandle: material,
      materialKey: `${assetHandleKey(material)}@${entry.version}`,
      sourceMaterialKey: assetHandleKey(material),
      pipelineKey: "matcap|matcapTexture|opaque|back|less|none",
      assets: registry,
      textureSamplerDependencies: emptyTextureSamplerDependencies(),
      viewUniforms: emptyViewUniforms(),
      worldTransforms: emptyTransforms(),
      sharedLayouts: [],
      materialLayout: null,
      preparedMeshes: createPreparedMeshGpuResourceCache(),
      preparedMatcapMaterials: createPreparedMatcapMaterialCache(),
      reuse: reuseCounters(),
    });

    expect(fallbackDiagnostic(result)).toMatchObject({
      code: "webGpuApp.preparedMaterialFallback",
      materialFamily: "matcap",
      materialKey: "material:matcap-missing-layout",
      reason: "missing-layout",
      diagnostics: [
        {
          code: "preparedMatcapMaterial.missingLayout",
          materialKey: "material:matcap-missing-layout",
        },
      ],
    });
  });

  it("emits a Matcap fallback diagnostic when prepared texture resources are missing", () => {
    const registry = new AssetRegistry();
    const material = createMaterialHandle("matcap-missing-texture-resource");
    const texture = createTextureHandle("matcap-albedo");
    const sampler = createSamplerHandle("matcap-linear");

    registry.register(material);
    registry.register(texture);
    registry.register(sampler);
    registry.markReady(texture, textureAsset("MatcapAlbedo"));
    registry.markReady(sampler, createSamplerAsset());
    const entry = registry.markReady(
      material,
      createMatcapMaterialAsset({
        matcapTexture: { texture, sampler },
      }),
    );

    const result = createOrReuseMatcapAppFrameResources({
      device: deviceWithBuffers(),
      cache: { current: null },
      mesh: null,
      meshHandle: createMeshHandle("missing"),
      meshKey: "mesh:missing@1",
      material: required(entry.asset),
      materialHandle: material,
      materialKey: `${assetHandleKey(material)}@${entry.version}`,
      sourceMaterialKey: assetHandleKey(material),
      pipelineKey: "matcap|matcapTexture|opaque|back|less|none",
      assets: registry,
      textureSamplerDependencies: emptyTextureSamplerDependencies(),
      viewUniforms: emptyViewUniforms(),
      worldTransforms: emptyTransforms(),
      sharedLayouts: [],
      materialLayout: matcapMaterialLayout(),
      preparedMeshes: createPreparedMeshGpuResourceCache(),
      preparedMatcapMaterials: createPreparedMatcapMaterialCache(),
      reuse: reuseCounters(),
    });

    expect(fallbackDiagnostic(result)).toMatchObject({
      code: "webGpuApp.preparedMaterialFallback",
      materialFamily: "matcap",
      materialKey: "material:matcap-missing-texture-resource",
      reason: "missing-prepared-dependency",
      diagnostics: [
        {
          code: "matcapMaterialBindGroupResource.missingTextureResource",
          resourceKey: "texture:matcap-albedo",
        },
        {
          code: "matcapMaterialBindGroupResource.missingSamplerResource",
          resourceKey: "sampler:matcap-linear",
        },
      ],
    });
  });

  it("emits a Standard fallback diagnostic when prepared material layout is missing", () => {
    const registry = new AssetRegistry();
    const material = createMaterialHandle("standard-missing-layout");

    registry.register(material);
    const entry = registry.markReady(material, createStandardMaterialAsset());
    const result = createOrReuseStandardAppFrameResources({
      device: {},
      cache: { current: null },
      snapshot: emptySnapshot(),
      mesh: null,
      meshHandle: createMeshHandle("missing"),
      meshKey: "mesh:missing@1",
      material: required(entry.asset),
      materialHandle: material,
      materialKey: `${assetHandleKey(material)}@${entry.version}`,
      sourceMaterialKey: assetHandleKey(material),
      pipelineKey: "standard|opaque|back|less|none",
      assets: registry,
      textureSamplerDependencies: emptyTextureSamplerDependencies(),
      viewUniforms: emptyViewUniforms(),
      worldTransforms: emptyTransforms(),
      sharedLayouts: [],
      materialLayout: null,
      lightLayout: null,
      preparedMeshes: createPreparedMeshGpuResourceCache(),
      preparedScalarMaterials: createPreparedScalarStandardMaterialCache(),
      reuse: standardReuseCounters(),
    });

    expect(fallbackDiagnostic(result)).toMatchObject({
      code: "webGpuApp.preparedMaterialFallback",
      materialFamily: "standard",
      materialKey: "material:standard-missing-layout",
      reason: "missing-layout",
      diagnostics: [
        {
          code: "preparedScalarStandardMaterial.missingLayout",
          materialKey: "material:standard-missing-layout",
        },
      ],
    });
  });

  it("emits a Standard fallback diagnostic when prepared texture resources are missing", () => {
    const registry = new AssetRegistry();
    const material = createMaterialHandle("standard-missing-texture-resource");
    const texture = createTextureHandle("standard-base-color");
    const sampler = createSamplerHandle("standard-linear");

    registry.register(material);
    registry.register(texture);
    registry.register(sampler);
    registry.markReady(texture, textureAsset("StandardBaseColor"));
    registry.markReady(sampler, createSamplerAsset());
    const entry = registry.markReady(
      material,
      createStandardMaterialAsset({
        baseColorTexture: { texture, sampler },
      }),
    );

    const result = createOrReuseStandardAppFrameResources({
      device: deviceWithBuffers(),
      cache: { current: null },
      snapshot: emptySnapshot(),
      mesh: null,
      meshHandle: createMeshHandle("missing"),
      meshKey: "mesh:missing@1",
      material: required(entry.asset),
      materialHandle: material,
      materialKey: `${assetHandleKey(material)}@${entry.version}`,
      sourceMaterialKey: assetHandleKey(material),
      pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
      assets: registry,
      textureSamplerDependencies: emptyTextureSamplerDependencies(),
      viewUniforms: emptyViewUniforms(),
      worldTransforms: emptyTransforms(),
      sharedLayouts: [],
      materialLayout: standardMaterialLayout(),
      lightLayout: null,
      preparedMeshes: createPreparedMeshGpuResourceCache(),
      preparedScalarMaterials: createPreparedScalarStandardMaterialCache(),
      reuse: standardReuseCounters(),
    });

    expect(fallbackDiagnostic(result)).toMatchObject({
      code: "webGpuApp.preparedMaterialFallback",
      materialFamily: "standard",
      materialKey: "material:standard-missing-texture-resource",
      reason: "missing-prepared-dependency",
      diagnostics: [
        {
          code: "standardMaterialBindGroupResource.missingTextureResource",
          resourceKey: "texture:standard-base-color",
        },
        {
          code: "standardMaterialBindGroupResource.missingSamplerResource",
          resourceKey: "sampler:standard-linear",
        },
      ],
    });
  });
});

function emptyTextureSamplerDependencies() {
  return {
    valid: true,
    textures: [],
    samplers: [],
    textureKeys: [],
    samplerKeys: [],
    diagnostics: [],
  };
}

function textureAsset(label: string) {
  return createTextureAsset({
    label,
    dimension: "2d",
    width: 1,
    height: 1,
    format: "rgba8unorm",
    colorSpace: "srgb",
    semantic: "base-color",
  });
}

function emptyViewUniforms() {
  return {
    data: new Float32Array(0),
    floatCount: 0,
    views: [],
    diagnostics: [],
  };
}

function emptyTransforms() {
  return {
    data: new Float32Array(0),
    floatCount: 0,
    offsets: [],
    diagnostics: [],
  };
}

function emptySnapshot(): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(0),
    viewMatrices: new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 0,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

function reuseCounters() {
  return {
    meshBuffersCreated: 0,
    meshBuffersReused: 0,
    preparedMeshBuffersCreated: 0,
    preparedMeshBuffersReused: 0,
    materialBuffersCreated: 0,
    materialBuffersReused: 0,
    preparedMaterialBuffersCreated: 0,
    preparedMaterialBuffersReused: 0,
    preparedMaterialBindGroupsCreated: 0,
    preparedMaterialBindGroupsReused: 0,
    bindGroupsCreated: 0,
    bindGroupsReused: 0,
    dynamicBufferWrites: 0,
  };
}

function standardReuseCounters() {
  return {
    ...reuseCounters(),
    lightBuffersCreated: 0,
    lightBuffersReused: 0,
  };
}

function materialLayout(): UnlitBindGroupLayoutResource {
  return {
    group: 2,
    layoutKey: "layout:unlit/material",
    layout: { group: 2 },
    metadata: createUnlitBindGroupLayoutMetadata(2, "layout:unlit/material"),
  };
}

function matcapMaterialLayout(): MatcapMaterialBindGroupLayoutResource {
  return {
    group: 2,
    layoutKey: "layout:matcap/material",
    layout: { group: 2 },
    descriptor: createMatcapMaterialBindGroupLayoutPlan(
      "layout:matcap/material",
    ).layout,
  };
}

function standardMaterialLayout(): StandardMaterialBindGroupLayoutResource {
  return {
    group: 2,
    layoutKey: "layout:standard/material",
    layout: { group: 2 },
    descriptor: createStandardMaterialBindGroupLayoutPlan(
      "layout:standard/material",
    ).layout,
  };
}

function deviceWithBuffers(): WebGpuBufferDeviceLike & {
  createBindGroup: (descriptor: unknown) => unknown;
} {
  return {
    queue: {
      writeBuffer: () => undefined,
    },
    createBuffer: (descriptor) => ({ descriptor }),
    createBindGroup: (descriptor: unknown) => ({ descriptor }),
  };
}

function fallbackDiagnostic(result: {
  readonly diagnostics: readonly unknown[];
}) {
  const diagnostic = result.diagnostics.find(
    (
      entry,
    ): entry is {
      readonly code: "webGpuApp.preparedMaterialFallback";
      readonly materialFamily: string;
      readonly materialKey: string;
      readonly reason: string;
      readonly diagnostics: readonly unknown[];
    } =>
      typeof entry === "object" &&
      entry !== null &&
      "code" in entry &&
      entry.code === "webGpuApp.preparedMaterialFallback",
  );

  if (diagnostic === undefined) {
    throw new Error("Expected a prepared material fallback diagnostic.");
  }

  return diagnostic;
}

function required<T>(value: T | null): T {
  if (value === null) {
    throw new Error("Expected fixture value to be present.");
  }

  return value;
}
