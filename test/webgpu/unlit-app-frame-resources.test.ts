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
  createBoxMeshAsset,
  createMatcapMaterialAsset,
  createSamplerAsset,
  createStandardMaterialAsset,
  createTextureAsset,
  type LightPacket,
  type RenderSnapshot,
} from "@aperture-engine/render";
import {
  createDirectionalShadowMatrixComputationReport,
  createDirectionalShadowViewProjectionPlanReport,
  createMatcapMaterialBindGroupLayoutPlan,
  createLightBindGroupLayoutDescriptor,
  createOrReuseMatcapAppFrameResources,
  createOrReuseStandardAppFrameResources,
  createOrReuseUnlitAppFrameResources,
  createPreparedMatcapMaterialCache,
  createPreparedMeshGpuResourceCache,
  createPreparedScalarStandardMaterialCache,
  createPreparedScalarUnlitMaterialCache,
  createShadowDepthTextureResourceReport,
  createShadowMapDescriptorReport,
  createShadowMatrixBufferDescriptorReport,
  createShadowMatrixBufferResourceReport,
  createShadowPassPlanReport,
  createShadowSamplerResourceReport,
  createShadowTextureResourceReport,
  createStandardMaterialBindGroupLayoutPlan,
  createStandardLightShadowBindGroupLayoutDescriptor,
  createUnlitBindGroupLayoutMetadata,
  createUnlitMaterialAsset,
  type LightBindGroupLayoutResource,
  type MatcapMaterialBindGroupLayoutResource,
  type StandardLightShadowBindGroupLayoutResource,
  type StandardMaterialBindGroupLayoutResource,
  type UnlitBindGroupLayoutResource,
  type TextureGpuDeviceLike,
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

  it("routes shadowMap Standard frame resources through the combined light/shadow group 3 bind group", () => {
    const registry = new AssetRegistry();
    const material = createMaterialHandle("standard-shadow-receiver");
    const mesh = createMeshHandle("standard-shadow-plane");
    const createdBindGroups: unknown[] = [];
    const device = deviceWithShadowResources({ createdBindGroups });

    registry.register(material);
    registry.register(mesh);
    const materialEntry = registry.markReady(
      material,
      createStandardMaterialAsset(),
    );
    const shadowResources = standardShadowReceiverResources(device);

    const result = createOrReuseStandardAppFrameResources({
      device,
      cache: { current: null },
      snapshot: snapshotWithLight(),
      mesh: createBoxMeshAsset({ label: "ShadowReceiver" }),
      meshHandle: mesh,
      meshKey: `${assetHandleKey(mesh)}@1`,
      material: required(materialEntry.asset),
      materialHandle: material,
      materialKey: `${assetHandleKey(material)}@${materialEntry.version}`,
      sourceMaterialKey: assetHandleKey(material),
      pipelineKey: "standard|shadowMap|opaque|back|less|none",
      assets: registry,
      textureSamplerDependencies: emptyTextureSamplerDependencies(),
      viewUniforms: validViewUniforms(),
      worldTransforms: validTransforms(),
      sharedLayouts: [sharedLayout(0), sharedLayout(1)],
      materialLayout: standardMaterialLayout(),
      lightLayout: standardLightShadowLayout(),
      shadowReceiverResources: shadowResources,
      preparedMeshes: createPreparedMeshGpuResourceCache(),
      preparedScalarMaterials: createPreparedScalarStandardMaterialCache(),
      reuse: standardReuseCounters(),
    });

    expect(result.valid).toBe(true);
    expect(result.resources?.lightBindGroup).toMatchObject({
      group: 3,
      layoutKey: "webgpu-app/standard/lights-shadow/group-3",
      entryResourceKeys: [
        "light-buffer:main/floats",
        "light-buffer:main/metadata",
        "shadow-matrix-buffer:directional",
        "shadow-map:7:light:11:texture",
        "shadow-sampler:directional",
      ],
    });
    expect(result.resources?.bindGroups.at(-1)).toBe(
      result.resources?.lightBindGroup,
    );
    expect(createdBindGroups).toHaveLength(4);
  });

  it("does not reuse cached Standard frame resources across pipeline keys", () => {
    const registry = new AssetRegistry();
    const material = createMaterialHandle("standard-live-route");
    const mesh = createMeshHandle("standard-live-route-box");
    const createdBindGroups: unknown[] = [];
    const device = deviceWithShadowResources({ createdBindGroups });
    const cache = { current: null };
    const preparedMeshes = createPreparedMeshGpuResourceCache();
    const preparedMaterials = createPreparedScalarStandardMaterialCache();

    registry.register(material);
    registry.register(mesh);
    const materialEntry = registry.markReady(
      material,
      createStandardMaterialAsset(),
    );
    const common = {
      device,
      cache,
      snapshot: snapshotWithLight(),
      mesh: createBoxMeshAsset({ label: "LiveRouteBox" }),
      meshHandle: mesh,
      meshKey: `${assetHandleKey(mesh)}@1`,
      material: required(materialEntry.asset),
      materialHandle: material,
      materialKey: `${assetHandleKey(material)}@${materialEntry.version}`,
      sourceMaterialKey: assetHandleKey(material),
      assets: registry,
      textureSamplerDependencies: emptyTextureSamplerDependencies(),
      viewUniforms: validViewUniforms(),
      worldTransforms: validTransforms(),
      sharedLayouts: [sharedLayout(0), sharedLayout(1)],
      materialLayout: standardMaterialLayout(),
      preparedMeshes,
      preparedScalarMaterials: preparedMaterials,
    };
    const direct = createOrReuseStandardAppFrameResources({
      ...common,
      pipelineKey: "standard|opaque|back|less|none",
      lightLayout: standardLightLayout(),
      reuse: standardReuseCounters(),
    });
    const shadow = createOrReuseStandardAppFrameResources({
      ...common,
      pipelineKey: "standard|shadowMap|opaque|back|less|none",
      lightLayout: standardLightShadowLayout(),
      shadowReceiverResources: standardShadowReceiverResources(device),
      reuse: standardReuseCounters(),
    });

    expect(direct.valid).toBe(true);
    expect(shadow.valid).toBe(true);
    expect(shadow.resources?.materialBindGroup).not.toBe(
      direct.resources?.materialBindGroup,
    );
    expect(shadow.resources?.materialBindGroup.bindGroup).not.toBe(
      direct.resources?.materialBindGroup.bindGroup,
    );
    expect(shadow.resources?.lightBindGroup.layoutKey).toBe(
      "webgpu-app/standard/lights-shadow/group-3",
    );
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

function validViewUniforms() {
  return {
    data: new Float32Array(20),
    floatCount: 20,
    views: [{ viewId: 1, sourceOffset: 0, packedOffset: 0 }],
    diagnostics: [],
  };
}

function validTransforms() {
  return {
    data: identityTransform(),
    floatCount: 16,
    offsets: [{ renderId: 1, sourceOffset: 0, packedOffset: 0 }],
    diagnostics: [],
  };
}

function emptySnapshot(
  input: {
    readonly lights?: readonly LightPacket[];
  } = {},
): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws: [],
    lights: input.lights ?? [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(0),
    viewMatrices: new Float32Array(0),
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

function snapshotWithLight(): RenderSnapshot {
  return emptySnapshot({ lights: [light()] });
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

function sharedLayout(group: 0 | 1): UnlitBindGroupLayoutResource {
  return {
    group,
    layoutKey: `layout:standard/shared-${group}`,
    layout: { group },
    metadata: createUnlitBindGroupLayoutMetadata(
      group,
      `layout:standard/shared-${group}`,
    ),
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

function standardLightLayout(): LightBindGroupLayoutResource {
  return {
    group: 3,
    layoutKey: "webgpu-app/standard/group-3",
    layout: { group: 3 },
    descriptor: createLightBindGroupLayoutDescriptor({
      group: 3,
      label: "webgpu-app/standard/group-3",
    }),
  };
}

function standardLightShadowLayout(): StandardLightShadowBindGroupLayoutResource {
  return {
    group: 3,
    layoutKey: "webgpu-app/standard/lights-shadow/group-3",
    layout: { group: 3 },
    descriptor: createStandardLightShadowBindGroupLayoutDescriptor(),
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

function standardShadowReceiverResources(
  device: TextureGpuDeviceLike &
    WebGpuBufferDeviceLike & {
      createSampler: (descriptor: unknown) => unknown;
    },
) {
  const descriptor = createShadowMapDescriptorReport({
    shadowRequests: [shadowRequest()],
    descriptors: [
      { shadowId: 7, lightId: 11, mapSize: 1024, depthBias: 0.001 },
    ],
  });
  const textures = createShadowTextureResourceReport({
    descriptors: descriptor,
  });
  const passPlan = createShadowPassPlanReport({
    shadowRequests: [shadowRequest()],
    textures,
  });
  const viewProjection = createDirectionalShadowViewProjectionPlanReport({
    shadowRequests: [shadowRequest()],
    lights: [light()],
    shadowPassPlan: passPlan,
  });
  const matrixBuffer = createShadowMatrixBufferDescriptorReport({
    viewProjection,
    upload: "ready",
  });
  const matrices = createDirectionalShadowMatrixComputationReport({
    viewProjection,
    transforms: identityTransform(),
  });

  return {
    matrixBufferResource: createShadowMatrixBufferResourceReport({
      device,
      descriptor: matrixBuffer,
      matrices,
    }),
    depthTextureResources: createShadowDepthTextureResourceReport({
      device,
      textures,
    }),
    samplerResource: createShadowSamplerResourceReport({
      device,
      cache: new Map(),
    }),
  };
}

function shadowRequest() {
  return {
    shadowId: 7,
    lightId: 11,
    casterLayerMask: 1,
    receiverLayerMask: 1,
  };
}

function light(): LightPacket {
  return {
    lightId: 11,
    entity: { index: 1, generation: 0 },
    kind: "directional",
    color: [1, 1, 1, 1],
    intensity: 1,
    range: 0,
    innerConeAngle: 0,
    outerConeAngle: 0,
    worldTransformOffset: 0,
    layerMask: 1,
  };
}

function identityTransform(): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function deviceWithShadowResources(captures: {
  readonly createdBindGroups: unknown[];
}): TextureGpuDeviceLike &
  WebGpuBufferDeviceLike & {
    createBindGroup: (descriptor: unknown) => unknown;
    createSampler: (descriptor: unknown) => unknown;
  } {
  return {
    queue: {
      writeBuffer: () => undefined,
    },
    createBuffer: (descriptor) => ({ descriptor }),
    createTexture: (descriptor) => ({
      createView: () => ({ descriptor }),
    }),
    createSampler: (descriptor) => ({ descriptor }),
    createBindGroup: (descriptor) => {
      captures.createdBindGroups.push(descriptor);
      return { descriptor };
    },
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
