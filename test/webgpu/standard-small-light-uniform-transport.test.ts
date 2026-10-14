import { describe, expect, it } from "vitest";
import {
  AssetRegistry,
  assetHandleKey,
  createMaterialHandle,
  createMeshHandle,
} from "@aperture-engine/simulation";
import {
  createBoxMeshAsset,
  createStandardMaterialAsset,
  type LightPacket,
} from "@aperture-engine/render";
import {
  createLightBufferDescriptor,
  createLightBufferDescriptorPlan,
  createLightBufferDescriptorPlanScratch,
  createLightBufferDescriptorScratch,
  createLightGpuBuffers,
  packLightPackets,
  writeLightBufferDescriptor,
  writeLightBufferDescriptorPlan,
  type LightBufferTransport,
} from "../../packages/webgpu/src/lighting/light-packing.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../../packages/webgpu/src/resources/meshes/mesh-buffer-descriptors.js";
import {
  type WebGpuBufferCreateDescriptor,
  type WebGpuBufferDeviceLike,
} from "../../packages/webgpu/src/gpu/buffer.js";
import { createEmptyRenderSnapshot } from "../../packages/webgpu/src/app/snapshot.js";
import { createWebGpuAppOwnedResources } from "../../packages/webgpu/src/app/owned-resources.js";
import { createStandardRenderPlan } from "../../packages/webgpu/src/materials/standard/standard-render-plan.js";
import {
  createOrReuseStandardAppFrameResources,
  createStandardAppFrameResourceCacheSlot,
  type StandardAppFrameResourceReuseReport,
} from "../../packages/webgpu/src/materials/standard/standard-app-frame-resources.js";
import {
  createDirectionalShadowMatrixComputationReport,
  createDirectionalShadowViewProjectionPlanReport,
  createPreparedMeshGpuResourceCache,
  createPreparedScalarStandardMaterialCache,
  createShadowDepthTextureResourceReport,
  createShadowMapDescriptorReport,
  createShadowMatrixBufferDescriptorReport,
  createShadowMatrixBufferResourceReport,
  createShadowPassPlanReport,
  createShadowSamplerResourceReport,
  createShadowTextureResourceReport,
  createStandardMaterialBindGroupLayoutPlan,
  createUnlitBindGroupLayoutMetadata,
  type StandardLightShadowBindGroupLayoutResource,
  type StandardMaterialBindGroupLayoutResource,
  type TextureGpuDeviceLike,
  type UnlitBindGroupLayoutResource,
} from "@aperture-engine/webgpu/test-support";

const uniform = "sun-ambient-v1" as const;
const baseKey =
  "standard|standard-light-mask-3|standard-light-layout-2-1_0|standard-single-shadow-owner-0|standard-directional-filter-1|shadowMap|opaque|back|less|none";
const uniformKey = baseKey.replace(
  "|shadowMap|",
  "|standard-small-light-uniforms-v1|shadowMap|",
);
const identity = () =>
  new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
function light(
  kind: "directional" | "ambient",
  lightId: number,
  intensity = 1,
): LightPacket {
  return {
    lightId,
    kind,
    entity: { index: lightId, generation: 0 },
    color: [0.7, 0.8, 0.9, 1],
    intensity,
    range: 10,
    innerConeAngle: 0,
    outerConeAngle: 0,
    worldTransformOffset: 0,
    layerMask: 1,
  };
}
const source = (intensity = 1, layerMask = 1) => ({
  ...createEmptyRenderSnapshot(1),
  lights: [
    { ...light("directional", 11, intensity), layerMask },
    light("ambient", 12),
  ],
  transforms: identity(),
  shadowRequests: [
    {
      shadowId: 7,
      lightId: 11,
      lightKind: "directional" as const,
      cascadeCount: 1,
      casterLayerMask: 1,
      receiverLayerMask: 1,
      shadowType: 1,
      strength: 0.7,
      depthBias: 0.001,
      normalBias: 0.02,
    },
  ],
});
const words = (data: ArrayBufferView) =>
  Array.from(
    new Uint32Array(data.buffer, data.byteOffset, data.byteLength / 4),
  );
interface BufferCapture {
  descriptor: WebGpuBufferCreateDescriptor;
  bytes: Uint8Array;
  destroyed: boolean;
  destroy(): void;
}
function deviceCapture() {
  const buffers: BufferCapture[] = [],
    writes: { buffer: BufferCapture; offset: number; bytes: number }[] = [],
    bindGroups: unknown[] = [];
  const device: WebGpuBufferDeviceLike &
    TextureGpuDeviceLike & {
      createBindGroup(descriptor: unknown): unknown;
      createTexture(descriptor: unknown): { createView(): unknown };
      createSampler(descriptor: unknown): unknown;
    } = {
    createBuffer(descriptor) {
      const buffer = {
        descriptor,
        bytes: new Uint8Array(descriptor.size),
        destroyed: false,
        destroy() {
          this.destroyed = true;
        },
      };
      buffers.push(buffer);
      return buffer;
    },
    queue: {
      writeTexture() {
        throw new Error(
          "This buffer/depth-resource test does not upload texture pixels",
        );
      },
      writeBuffer(buffer, offset, data, dataOffset = 0, size) {
        const typed = ArrayBuffer.isView(data),
          unit = typed
            ? "BYTES_PER_ELEMENT" in data
              ? Number(data.BYTES_PER_ELEMENT)
              : 1
            : 1,
          start = (typed ? data.byteOffset : 0) + dataOffset * unit,
          length =
            size === undefined
              ? (typed ? data.byteLength : data.byteLength) - dataOffset * unit
              : size * unit,
          capture = buffer as BufferCapture;
        capture.bytes.set(
          new Uint8Array(typed ? data.buffer : data, start, length),
          offset,
        );
        writes.push({ buffer: capture, offset, bytes: length });
      },
    },
    createBindGroup(descriptor) {
      const group = { descriptor };
      bindGroups.push(group);
      return group;
    },
    createTexture(descriptor) {
      return { createView: () => ({ descriptor }) };
    },
    createSampler(descriptor) {
      return { descriptor };
    },
  };
  return { device, buffers, writes, bindGroups };
}

describe("two-light uniform transport", () => {
  it.each([false, true])(
    "preserves every packed word and supplies alignment/header with ambient-first %s",
    (ambientFirst) => {
      const snapshot = source(),
        packed = packLightPackets({
          ...snapshot,
          lights: ambientFirst
            ? [...snapshot.lights].reverse()
            : snapshot.lights,
        });
      // Copying transport must preserve raw f32 words, including NaN payload/-0.
      new Uint32Array(packed.floats.buffer)[6] = 0x7fc01234;
      new Uint32Array(packed.floats.buffer)[7] = 0x80000000;
      const before = words(packed.floats),
        metadata = words(packed.metadata),
        descriptor = createLightBufferDescriptor(packed),
        plan = createLightBufferDescriptorPlan(descriptor, {
          transport: uniform,
        }).plan!;
      expect(plan.source).toBe(packed);
      expect(packed.floats).toHaveLength(58);
      expect(packed.metadata).toHaveLength(12);
      expect(words(plan.floatDescriptor.initialData!)).toEqual([
        ...before,
        0,
        0,
      ]);
      expect(words(plan.metadataDescriptor.initialData!)).toEqual([
        ...metadata,
        2,
        58,
        0,
        0,
      ]);
      expect(words(packed.floats)).toEqual(before);
      expect(words(packed.metadata)).toEqual(metadata);
      expect(plan.floatDescriptor.size).toBe(240);
      expect(plan.metadataDescriptor.size).toBe(64);
      for (const entry of [plan.floatDescriptor, plan.metadataDescriptor])
        expect(entry.usage).toBe(
          WEBGPU_BUFFER_USAGE_FLAGS.UNIFORM |
            WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
        );
      const capture = deviceCapture(),
        created = createLightGpuBuffers({ device: capture.device, plan });
      expect(created.valid).toBe(true);
      expect(capture.buffers).toHaveLength(2);
      expect(words(capture.buffers[0]!.bytes)).toEqual([...before, 0, 0]);
      expect(words(capture.buffers[1]!.bytes)).toEqual([
        ...metadata,
        2,
        58,
        0,
        0,
      ]);
    },
  );
  it("reuses padded CPU arrays while keeping original dirty windows", () => {
    const packing = createLightBufferDescriptorScratch(),
      plans = createLightBufferDescriptorPlanScratch();
    const first = writeLightBufferDescriptor(source(), packing),
      plan = writeLightBufferDescriptorPlan(first, plans, {
        transport: uniform,
      }).plan!,
      floatData = plan.floatDescriptor.initialData,
      metadataData = plan.metadataDescriptor.initialData;
    const stable = writeLightBufferDescriptor(source(), packing);
    expect(stable.floatsDirty).toBeNull();
    expect(stable.metadataDirty).toBeNull();
    writeLightBufferDescriptorPlan(stable, plans, { transport: uniform });
    expect(plan.floatDescriptor.initialData).toBe(floatData);
    expect(plan.metadataDescriptor.initialData).toBe(metadataData);
    const changed = writeLightBufferDescriptor(source(3), packing);
    expect(changed.floatsDirty).toMatchObject({
      floatOffset: 4,
      floatCount: 1,
      full: false,
    });
    expect(changed.metadataDirty).toBeNull();
    writeLightBufferDescriptorPlan(changed, plans, { transport: uniform });
    expect(plan.floatDescriptor.initialData).toBe(floatData);
    expect(words(plan.metadataDescriptor.initialData!).slice(12)).toEqual([
      2, 58, 0, 0,
    ]);
    const general = writeLightBufferDescriptorPlan(changed, plans, {
      transport: "storage",
    }).plan!;
    expect(general.floatDescriptor.initialData).toBe(changed.packed.floats);
    expect(general.floatDescriptor.size).toBe(232);
    expect(general.metadataDescriptor.size).toBe(48);
    writeLightBufferDescriptorPlan(changed, plans, { transport: uniform });
    expect(plan.floatDescriptor.initialData).toBe(floatData);
    expect(plan.metadataDescriptor.initialData).toBe(metadataData);
  });
  it("rejects unsupported tuples and storage usage before GPU creation", () => {
    for (const lights of [
      [],
      [light("ambient", 1)],
      [light("ambient", 1), light("ambient", 2)],
      [light("directional", 1), light("directional", 2)],
      [...source().lights, light("ambient", 3)],
    ]) {
      const result = createLightBufferDescriptorPlan(
        createLightBufferDescriptor(lights),
        { transport: uniform },
      );
      expect(result.valid).toBe(false);
      expect(result.plan).toBeNull();
      expect(result.diagnostics[0]?.code).toBe(
        "lightBufferDescriptor.unsupportedUniformTransport",
      );
    }
    const result = createLightBufferDescriptorPlan(
      createLightBufferDescriptor(source()),
      {
        transport: uniform,
        usage:
          WEBGPU_BUFFER_USAGE_FLAGS.STORAGE |
          WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      },
    );
    expect(result.valid).toBe(false);
  });
  it("updates numeric uniforms without resource churn and restores independent cached storage/uniform routes", () => {
    const capture = deviceCapture(),
      owned = createWebGpuAppOwnedResources(capture.device),
      registry = new AssetRegistry(),
      materialHandle = createMaterialHandle("uniform-cache"),
      meshHandle = createMeshHandle("uniform-cache");
    registry.register(materialHandle);
    registry.register(meshHandle);
    const asset = createStandardMaterialAsset(),
      entry = registry.markReady(materialHandle, asset),
      cache = createStandardAppFrameResourceCacheSlot(),
      shadows = shadowResources(owned.device);
    const common = {
      device: owned.device,
      cache,
      mesh: createBoxMeshAsset(),
      meshHandle,
      meshKey: `${assetHandleKey(meshHandle)}@1`,
      material: asset,
      materialHandle,
      materialKey: `${assetHandleKey(materialHandle)}@${entry.version}`,
      sourceMaterialKey: assetHandleKey(materialHandle),
      assets: registry,
      textureSamplerDependencies: {
        valid: true,
        textures: [],
        samplers: [],
        textureKeys: [],
        samplerKeys: [],
        diagnostics: [],
      },
      viewUniforms: {
        data: new Float32Array(20),
        floatCount: 20,
        views: [{ viewId: 1, sourceOffset: 0, packedOffset: 0 }],
        diagnostics: [],
        contentVersion: 1,
      },
      worldTransforms: {
        data: identity(),
        floatCount: 16,
        offsets: [{ renderId: 1, sourceOffset: 0, packedOffset: 0 }],
        diagnostics: [],
        contentVersion: 1,
      },
      sharedLayouts: [sharedLayout(0), sharedLayout(1)],
      materialLayout: materialLayout(),
      shadowReceiverResources: shadows,
      preparedMeshes: createPreparedMeshGpuResourceCache(),
      preparedScalarMaterials: createPreparedScalarStandardMaterialCache(),
    };
    const render = (
      transport: LightBufferTransport,
      intensity = 1,
      layerMask = 1,
    ) => {
      const pipelineKey = transport === uniform ? uniformKey : baseKey,
        standardRenderPlan = createStandardRenderPlan({ pipelineKey });
      expect(standardRenderPlan.lightTransport).toBe(transport);
      const reuse = reuseCounters(),
        lightLayout: StandardLightShadowBindGroupLayoutResource = {
          group: 3,
          layoutKey: standardRenderPlan.structuralKey,
          layout: { key: standardRenderPlan.structuralKey },
          descriptor: standardRenderPlan.lightBindingLayout,
        };
      const result = createOrReuseStandardAppFrameResources({
        ...common,
        snapshot: source(intensity, layerMask),
        pipelineKey,
        standardRenderPlan,
        lightLayout,
        reuse,
      });
      expect(result.valid).toBe(true);
      return { result, reuse };
    };
    const initial = render(uniform),
      floatBuffer = initial.result.resources!.lightGpuBuffers.resource!
        .floatBuffer as BufferCapture,
      metadataBuffer = initial.result.resources!.lightGpuBuffers.resource!
        .metadataBuffer as BufferCapture,
      bufferCount = capture.buffers.length,
      groupCount = capture.bindGroups.length;
    capture.writes.length = 0;
    const stable = render(uniform);
    expect(stable.result).toBe(initial.result);
    expect(capture.buffers).toHaveLength(bufferCount);
    expect(capture.bindGroups).toHaveLength(groupCount);
    expect(capture.writes).toHaveLength(0);
    const numeric = render(uniform, 3);
    expect(numeric.result).toBe(initial.result);
    expect(capture.buffers).toHaveLength(bufferCount);
    expect(capture.bindGroups).toHaveLength(groupCount);
    expect(capture.writes).toEqual([
      { buffer: floatBuffer, offset: 16, bytes: 4 },
    ]);
    expect(words(floatBuffer.bytes).slice(0, 58)).toEqual(
      words(packLightPackets(source(3)).floats),
    );
    expect(words(floatBuffer.bytes).slice(58)).toEqual([0, 0]);
    expect(words(metadataBuffer.bytes).slice(12)).toEqual([2, 58, 0, 0]);
    capture.writes.length = 0;
    const metadata = render(uniform, 3, 2);
    expect(metadata.result).toBe(initial.result);
    expect(capture.buffers).toHaveLength(bufferCount);
    expect(capture.bindGroups).toHaveLength(groupCount);
    expect(capture.writes).toEqual([
      { buffer: metadataBuffer, offset: 8, bytes: 4 },
    ]);
    expect(words(metadataBuffer.bytes).slice(0, 12)).toEqual(
      words(packLightPackets(source(3, 2)).metadata),
    );
    expect(words(metadataBuffer.bytes).slice(12)).toEqual([2, 58, 0, 0]);
    const general = render("storage", 3, 2),
      generalFloat = general.result.resources!.lightGpuBuffers.resource!
        .floatBuffer as BufferCapture;
    expect(generalFloat).not.toBe(floatBuffer);
    expect(generalFloat.descriptor.size).toBe(232);
    expect(
      generalFloat.descriptor.usage & WEBGPU_BUFFER_USAGE_FLAGS.STORAGE,
    ).not.toBe(0);
    const restoredCounts = [capture.buffers.length, capture.bindGroups.length];
    capture.writes.length = 0;
    const restored = render(uniform, 5, 2);
    expect(restored.result).toBe(initial.result);
    expect([capture.buffers.length, capture.bindGroups.length]).toEqual(
      restoredCounts,
    );
    expect(capture.writes).toEqual([
      { buffer: floatBuffer, offset: 16, bytes: 4 },
    ]);
    expect(words(floatBuffer.bytes).slice(0, 58)).toEqual(
      words(packLightPackets(source(5, 2)).floats),
    );
    expect(words(metadataBuffer.bytes).slice(12)).toEqual([2, 58, 0, 0]);
    expect(floatBuffer.destroyed).toBe(false);
    expect(generalFloat.destroyed).toBe(false);
    owned.dispose();
    expect(floatBuffer.destroyed).toBe(true);
    expect(metadataBuffer.destroyed).toBe(true);
    expect(generalFloat.destroyed).toBe(true);
    expect(capture.buffers.every((buffer) => buffer.destroyed)).toBe(true);
  });
});
function sharedLayout(group: 0 | 1): UnlitBindGroupLayoutResource {
  return {
    group,
    layoutKey: `shared-${group}`,
    layout: { group },
    metadata: createUnlitBindGroupLayoutMetadata(group, `shared-${group}`),
  };
}
function materialLayout(): StandardMaterialBindGroupLayoutResource {
  return {
    group: 2,
    layoutKey: "material",
    layout: { group: 2 },
    descriptor: createStandardMaterialBindGroupLayoutPlan("material").layout,
  };
}
function reuseCounters(): StandardAppFrameResourceReuseReport {
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
    lightBuffersCreated: 0,
    lightBuffersReused: 0,
    standardFrameResourceCacheHits: 0,
    standardFrameResourceCacheMisses: 0,
    standardFrameResourceCacheMissReasons: {},
    localLightClusterBuffersCreated: 0,
    localLightClusterBuffersReused: 0,
    localLightClusterBufferWrites: 0,
    localLightClusterBufferWritesSkipped: 0,
    dynamicBufferWrites: 0,
  };
}
function shadowResources(device: ReturnType<typeof deviceCapture>["device"]) {
  const shadowRequests = source().shadowRequests,
    descriptors = createShadowMapDescriptorReport({
      shadowRequests,
      descriptors: [
        { shadowId: 7, lightId: 11, mapSize: 16, depthBias: 0.001 },
      ],
    }),
    textures = createShadowTextureResourceReport({ descriptors }),
    shadowPassPlan = createShadowPassPlanReport({ shadowRequests, textures }),
    viewProjection = createDirectionalShadowViewProjectionPlanReport({
      shadowRequests,
      lights: source().lights,
      shadowPassPlan,
    }),
    descriptor = createShadowMatrixBufferDescriptorReport({
      viewProjection,
      upload: "ready",
    }),
    matrices = createDirectionalShadowMatrixComputationReport({
      viewProjection,
      transforms: identity(),
    });
  return {
    matrixBufferResource: createShadowMatrixBufferResourceReport({
      device,
      descriptor,
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
