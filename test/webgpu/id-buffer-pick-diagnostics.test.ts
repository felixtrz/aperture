import { describe, expect, it } from "vitest";

import type { BatchCompatibilityKey } from "@aperture-engine/render";
import {
  createMaterialHandle,
  createMeshHandle,
  createWebGpuIdBufferIdForEntity,
  createWebGpuIdBufferPickBindGroup,
  createWebGpuIdBufferPickCommands,
  createWebGpuIdBufferPickIdStorage,
  createWebGpuIdBufferPickPipelineResource,
  createWebGpuIdBufferPickTexture,
  readWebGpuIdBufferPickPixel,
  webGpuIdBufferPickPipelineCacheKey,
  WEBGPU_ID_BUFFER_EMPTY_ID,
  WEBGPU_ID_BUFFER_FORMAT,
  type WebGpuIdBufferPickIdStorageResource,
  type WebGpuIdBufferPickPipelineResource,
  type WebGpuIdBufferPickReadbackDeviceLike,
} from "@aperture-engine/webgpu/test-support";

describe("WebGPU ID-buffer picking diagnostics", () => {
  it("rejects batch keys with unsupported topologies, skinning, morphing, or layouts", async () => {
    const topology = await createWebGpuIdBufferPickPipelineResource({
      device: pickPipelineDevice(),
      batchKey: pickBatchKey({ topology: "line-list" }),
    });
    const skinned = await createWebGpuIdBufferPickPipelineResource({
      device: pickPipelineDevice(),
      batchKey: pickBatchKey({ skinned: true }),
    });
    const morphed = await createWebGpuIdBufferPickPipelineResource({
      device: pickPipelineDevice(),
      batchKey: pickBatchKey({ morphed: true }),
    });
    const layout = await createWebGpuIdBufferPickPipelineResource({
      device: pickPipelineDevice(),
      batchKey: pickBatchKey({
        meshLayoutKey: "stride=24,POSITION@0,NORMAL@12",
      }),
    });

    expect(topology).toMatchObject({
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "idBufferPick.unsupportedBatchKey",
          pipelineKey: "unlit|opaque|back|less|none",
          message: expect.stringContaining("'line-list'"),
        },
      ],
    });
    expect(skinned.diagnostics).toMatchObject([
      {
        code: "idBufferPick.unsupportedBatchKey",
        message: expect.stringContaining("rigid, unmorphed"),
      },
    ]);
    expect(morphed.diagnostics).toMatchObject([
      { code: "idBufferPick.unsupportedBatchKey" },
    ]);
    expect(layout.diagnostics).toMatchObject([
      {
        code: "idBufferPick.unsupportedBatchKey",
        message: expect.stringContaining("TEXCOORD_0"),
      },
    ]);
  });

  it("diagnoses devices that cannot create pick shader modules", async () => {
    const result = await createWebGpuIdBufferPickPipelineResource({
      device: {},
      batchKey: pickBatchKey({}),
    });

    expect(result).toMatchObject({
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "idBufferPick.shaderCreationFailed",
          message: "WebGPU device cannot create shader modules.",
        },
      ],
    });
  });

  it("diagnoses devices without createRenderPipeline", async () => {
    const result = await createWebGpuIdBufferPickPipelineResource({
      device: {
        createShaderModule: () => ({
          compilationInfo: async () => ({ messages: [] }),
        }),
      },
      batchKey: pickBatchKey({}),
    });

    expect(result.diagnostics).toEqual([
      {
        code: "idBufferPick.createRenderPipelineUnavailable",
        message: "WebGPU ID-buffer picking requires createRenderPipeline.",
      },
    ]);
  });

  it("diagnoses devices that cannot share pipeline layouts", async () => {
    const result = await createWebGpuIdBufferPickPipelineResource({
      device: {
        createShaderModule: () => ({
          compilationInfo: async () => ({ messages: [] }),
        }),
        createRenderPipeline: () => ({}),
      },
      batchKey: pickBatchKey({}),
    });

    expect(result.diagnostics).toMatchObject([
      { code: "idBufferPick.pipelineLayoutUnavailable" },
    ]);
  });

  it("surfaces pipeline validation errors from the device error scope", async () => {
    const scopeEvents: string[] = [];
    const result = await createWebGpuIdBufferPickPipelineResource({
      device: {
        ...pickPipelineDevice(),
        pushErrorScope: (filter: "validation") => {
          scopeEvents.push(`push:${filter}`);
        },
        popErrorScope: async () => ({
          message: "vertex shader location mismatch",
        }),
      },
      batchKey: pickBatchKey({}),
    });

    expect(scopeEvents).toEqual(["push:validation"]);
    expect(result).toMatchObject({
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "idBufferPick.pipelineCreationFailed",
          message: "vertex shader location mismatch",
        },
      ],
    });
  });

  it("keeps error scopes best-effort when they throw", async () => {
    const result = await createWebGpuIdBufferPickPipelineResource({
      device: {
        ...pickPipelineDevice(),
        pushErrorScope: () => {
          throw new Error("scope unavailable");
        },
        popErrorScope: async () => {
          throw new Error("scope lost");
        },
      },
      batchKey: pickBatchKey({}),
    });

    expect(result.valid).toBe(true);
    expect(result.resource?.cacheKey).toBe(
      webGpuIdBufferPickPipelineCacheKey(pickBatchKey({})),
    );
  });

  it("reports render pipeline creation exceptions", async () => {
    const result = await createWebGpuIdBufferPickPipelineResource({
      device: {
        ...pickPipelineDevice(),
        createRenderPipeline: () => {
          throw new Error("out of pipeline memory");
        },
      },
      batchKey: pickBatchKey({}),
    });

    expect(result.diagnostics).toEqual([
      {
        code: "idBufferPick.pipelineCreationFailed",
        message: "out of pipeline memory",
      },
    ]);
  });

  it("creates pick ID storage buffers from snapshot transforms", () => {
    const bufferDescriptors: { label?: string; usage?: number }[] = [];
    const entity = { index: 5, generation: 2 };
    const result = createWebGpuIdBufferPickIdStorage({
      device: {
        queue: { writeBuffer: () => {} },
        createBuffer: (descriptor) => {
          bufferDescriptors.push(descriptor);
          return { descriptor };
        },
      },
      snapshot: {
        transforms: new Float32Array(32),
        meshDraws: [
          pickMeshDraw({ renderId: 1, entity, worldTransformOffset: 16 }),
        ],
      },
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.resource?.resourceKey).toBe("id-buffer-pick/ids");
    expect(Array.from(result.resource?.ids ?? [])).toEqual([
      WEBGPU_ID_BUFFER_EMPTY_ID,
      createWebGpuIdBufferIdForEntity(entity),
    ]);
    expect(bufferDescriptors).toMatchObject([
      { label: "aperture/id-buffer-pick-ids", size: 8, usage: 0x88 },
    ]);
  });

  it("diagnoses pick ID storage buffer creation failures", () => {
    const result = createWebGpuIdBufferPickIdStorage({
      device: {},
      snapshot: { transforms: new Float32Array(16), meshDraws: [] },
    });

    expect(result).toMatchObject({
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "idBufferPick.createBufferFailed",
          message: expect.stringContaining("queue.writeBuffer"),
        },
      ],
    });
  });

  it("creates group-2 bind groups from the pipeline's shared layout", () => {
    const bindGroupDescriptors: { layout?: unknown }[] = [];
    const result = createWebGpuIdBufferPickBindGroup({
      device: {
        createBindGroup: (descriptor) => {
          bindGroupDescriptors.push(descriptor as { layout?: unknown });
          return "ids-bind-group";
        },
      },
      pipeline: pickPipeline({}),
      ids: pickIdStorage(),
    });

    expect(result.valid).toBe(true);
    expect(result.resource).toEqual({
      group: 2,
      resourceKey: "id-buffer-pick/ids",
      bindGroup: "ids-bind-group",
    });
    expect(bindGroupDescriptors).toMatchObject([
      { label: "aperture/id-buffer-pick-ids", layout: "pick-ids-layout" },
    ]);
  });

  it("falls back to getBindGroupLayout(2) when shared layouts are absent", () => {
    const layoutRequests: number[] = [];
    const result = createWebGpuIdBufferPickBindGroup({
      device: { createBindGroup: (descriptor) => ({ descriptor }) },
      pipeline: pickPipeline({
        layouts: { view: null, worldTransforms: null, ids: null },
        pipeline: {
          getBindGroupLayout: (group: number) => {
            layoutRequests.push(group);
            return `pipeline-layout:${group}`;
          },
        },
      }),
      ids: pickIdStorage(),
    });

    expect(result.valid).toBe(true);
    expect(layoutRequests).toEqual([2]);
  });

  it("diagnoses missing bind group support and missing group-2 layouts", () => {
    const unavailable = createWebGpuIdBufferPickBindGroup({
      device: {},
      pipeline: pickPipeline({}),
      ids: pickIdStorage(),
    });
    const missingLayout = createWebGpuIdBufferPickBindGroup({
      device: { createBindGroup: () => ({}) },
      pipeline: pickPipeline({
        layouts: { view: null, worldTransforms: null, ids: null },
        pipeline: {},
      }),
      ids: pickIdStorage(),
    });

    expect(unavailable.diagnostics).toEqual([
      {
        code: "idBufferPick.createBindGroupUnavailable",
        message: "WebGPU ID-buffer picking requires createBindGroup.",
      },
    ]);
    expect(missingLayout.diagnostics).toMatchObject([
      {
        code: "idBufferPick.pipelineLayoutUnavailable",
        message: expect.stringContaining("group 2"),
      },
    ]);
  });

  it("reports bind group creation exceptions", () => {
    const result = createWebGpuIdBufferPickBindGroup({
      device: {
        createBindGroup: () => {
          throw new Error("bind group rejected");
        },
      },
      pipeline: pickPipeline({}),
      ids: pickIdStorage(),
    });

    expect(result.diagnostics).toEqual([
      {
        code: "idBufferPick.createBindGroupFailed",
        message: "bind group rejected",
      },
    ]);
  });

  it("creates pick textures and binds their destroy handles", () => {
    const events: string[] = [];
    const textureDescriptors: { format?: string; usage?: number }[] = [];
    const withDestroy = createWebGpuIdBufferPickTexture({
      device: {
        createTexture: (descriptor) => {
          textureDescriptors.push(
            descriptor as { format?: string; usage?: number },
          );
          return {
            createView: () => ({}),
            destroy: () => events.push("texture:destroy"),
          };
        },
      },
      width: 32,
      height: 16,
    });
    const withoutDestroy = createWebGpuIdBufferPickTexture({
      device: { createTexture: () => ({}) },
      width: 8,
      height: 8,
    });

    expect(withDestroy.valid).toBe(true);
    expect(withDestroy.resource).toMatchObject({
      width: 32,
      height: 16,
      format: WEBGPU_ID_BUFFER_FORMAT,
    });
    withDestroy.resource?.destroy?.();
    expect(events).toEqual(["texture:destroy"]);
    expect(textureDescriptors).toMatchObject([
      {
        label: "aperture/id-buffer-pick-target",
        size: { width: 32, height: 16 },
        format: WEBGPU_ID_BUFFER_FORMAT,
        usage: 0x11,
      },
    ]);
    expect(withoutDestroy.valid).toBe(true);
    expect(withoutDestroy.resource?.destroy).toBeUndefined();
  });

  it("diagnoses unavailable and failing pick texture creation", () => {
    const unavailable = createWebGpuIdBufferPickTexture({
      device: {},
      width: 8,
      height: 8,
    });
    const failing = createWebGpuIdBufferPickTexture({
      device: {
        createTexture: () => {
          throw new Error("texture allocation failed");
        },
      },
      width: 8,
      height: 8,
    });

    expect(unavailable.diagnostics).toEqual([
      {
        code: "idBufferPick.createTextureUnavailable",
        message: "WebGPU ID-buffer picking requires createTexture.",
      },
    ]);
    expect(failing.diagnostics).toEqual([
      {
        code: "idBufferPick.createTextureUnavailable",
        message: "texture allocation failed",
      },
    ]);
  });

  it("diagnoses color-pass pipelines without a matching pick pipeline", () => {
    const result = createWebGpuIdBufferPickCommands({
      pipelineByKey: new Map(),
      viewBindGroup: {
        group: 0,
        resourceKey: "id-buffer-pick/view",
        bindGroup: "view-bind-group",
      },
      worldTransformBindGroup: {
        group: 1,
        resourceKey: "id-buffer-pick/world-transforms",
        bindGroup: "world-bind-group",
      },
      idBindGroup: {
        group: 2,
        resourceKey: "id-buffer-pick/ids",
        bindGroup: "ids-bind-group",
      },
      commands: [
        {
          kind: "setPipeline",
          renderId: 7,
          pipelineKey: "unlit|missing",
          pipeline: "color-pipeline",
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.commands).toEqual([]);
    expect(result.diagnostics).toEqual([
      {
        code: "idBufferPick.missingPickPipeline",
        renderId: 7,
        pipelineKey: "unlit|missing",
        message: "Missing ID-buffer picking pipeline for 'unlit|missing'.",
      },
    ]);
  });

  it("reads the picked entity id from the copied readback row", async () => {
    const calls: unknown[][] = [];
    const buffer = {
      mapAsync: async (mode: number) => {
        calls.push(["mapAsync", mode]);
      },
      getMappedRange: () => new Uint8Array([0x2a, 0, 0, 0, 9, 9, 9, 9]),
      unmap: () => {
        calls.push(["unmap"]);
      },
    };
    const texture = { label: "pick-texture" };
    const result = await readWebGpuIdBufferPickPixel({
      device: {
        queue: {
          submit: (commandBuffers) => calls.push(["submit", commandBuffers]),
        },
        createCommandEncoder: () => ({
          copyTextureToBuffer: (source, destination, copySize) => {
            calls.push(["copyTextureToBuffer", source, destination, copySize]);
          },
          finish: () => "pick-command-buffer",
        }),
        createBuffer: () => buffer,
      },
      texture,
      width: 8,
      height: 4,
      x: 2.9,
      y: 1.2,
    });

    expect(result).toEqual({
      ok: true,
      id: 42,
      origin: { x: 2, y: 1 },
      bytesPerRow: 256,
    });
    expect(calls).toContainEqual([
      "copyTextureToBuffer",
      { texture, origin: { x: 2, y: 1, z: 0 } },
      { buffer, bytesPerRow: 256, rowsPerImage: 1 },
      { width: 1, height: 1, depthOrArrayLayers: 1 },
    ]);
    expect(calls).toContainEqual(["submit", ["pick-command-buffer"]]);
    expect(calls).toContainEqual(["mapAsync", 0x1]);
    expect(calls).toContainEqual(["unmap"]);
  });

  it("decodes ids from mapped ranges returned as plain ArrayBuffers", async () => {
    const result = await readWebGpuIdBufferPickPixel({
      device: pickReadbackDevice({
        mapAsync: async () => {},
        getMappedRange: () => new Uint32Array([7]).buffer,
      }),
      texture: {},
      width: 4,
      height: 4,
      x: 0,
      y: 0,
      mapModeRead: 4,
    });

    expect(result).toMatchObject({ ok: true, id: 7 });
  });

  it("rejects readback origins outside the pick target", async () => {
    const result = await readWebGpuIdBufferPickPixel({
      device: pickReadbackDevice({}),
      texture: {},
      width: 8,
      height: 4,
      x: 8,
      y: 0,
    });

    expect(result).toEqual({
      ok: false,
      reason: "idBufferPick.invalidReadbackOrigin",
      message: "ID-buffer pick origin 8,0 is outside the 8x4 target.",
      origin: { x: 8, y: 0 },
    });
  });

  it("requires an encoder with copyTextureToBuffer and finish", async () => {
    const withoutEncoder = await readWebGpuIdBufferPickPixel({
      device: {},
      texture: {},
      width: 4,
      height: 4,
      x: 0,
      y: 0,
    });
    const withoutFinish = await readWebGpuIdBufferPickPixel({
      device: {
        createCommandEncoder: () => ({ copyTextureToBuffer: () => {} }),
      },
      texture: {},
      width: 4,
      height: 4,
      x: 0,
      y: 0,
    });

    expect(withoutEncoder).toMatchObject({
      ok: false,
      reason: "idBufferPick.copyTextureToBufferUnavailable",
    });
    expect(withoutFinish).toMatchObject({
      ok: false,
      reason: "idBufferPick.copyTextureToBufferUnavailable",
    });
  });

  it("requires a mappable readback buffer", async () => {
    const result = await readWebGpuIdBufferPickPixel({
      device: {
        createCommandEncoder: () => ({
          copyTextureToBuffer: () => {},
          finish: () => ({}),
        }),
      },
      texture: {},
      width: 4,
      height: 4,
      x: 0,
      y: 0,
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "idBufferPick.createReadbackBufferUnavailable",
    });
  });

  it("reports copy submission failures", async () => {
    const result = await readWebGpuIdBufferPickPixel({
      device: {
        createCommandEncoder: () => ({
          copyTextureToBuffer: () => {
            throw new Error("copy out of bounds");
          },
          finish: () => ({}),
        }),
        createBuffer: () => ({}),
      },
      texture: {},
      width: 4,
      height: 4,
      x: 0,
      y: 0,
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "idBufferPick.copyTextureToBufferUnavailable",
      message: "copy out of bounds",
    });
  });

  it("diagnoses buffers that cannot be mapped or expose mapped bytes", async () => {
    const withoutMapAsync = await readWebGpuIdBufferPickPixel({
      device: pickReadbackDevice({ getMappedRange: () => new Uint8Array(4) }),
      texture: {},
      width: 4,
      height: 4,
      x: 0,
      y: 0,
    });
    const withoutMappedRange = await readWebGpuIdBufferPickPixel({
      device: pickReadbackDevice({ mapAsync: async () => {} }),
      texture: {},
      width: 4,
      height: 4,
      x: 0,
      y: 0,
    });

    expect(withoutMapAsync).toMatchObject({
      ok: false,
      reason: "idBufferPick.mapReadUnavailable",
    });
    expect(withoutMappedRange).toMatchObject({
      ok: false,
      reason: "idBufferPick.mappedRangeUnavailable",
    });
  });

  it("reports map rejections and mapped-range decode failures", async () => {
    const mapRejected = await readWebGpuIdBufferPickPixel({
      device: pickReadbackDevice({
        mapAsync: async () => {
          throw new Error("map aborted");
        },
        getMappedRange: () => new Uint8Array(4),
      }),
      texture: {},
      width: 4,
      height: 4,
      x: 0,
      y: 0,
    });
    const rangeThrew = await readWebGpuIdBufferPickPixel({
      device: pickReadbackDevice({
        mapAsync: async () => {},
        getMappedRange: () => {
          throw new Error("range detached");
        },
      }),
      texture: {},
      width: 4,
      height: 4,
      x: 0,
      y: 0,
    });

    expect(mapRejected).toMatchObject({
      ok: false,
      reason: "idBufferPick.readbackMapFailed",
      message: "map aborted",
    });
    expect(rangeThrew).toMatchObject({
      ok: false,
      reason: "idBufferPick.mappedRangeUnavailable",
      message: "range detached",
    });
  });
});

function pickBatchKey(
  overrides: Partial<BatchCompatibilityKey>,
): BatchCompatibilityKey {
  return {
    pipelineKey: "unlit|opaque|back|less|none",
    materialKey: "material:pick",
    meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0",
    topology: "triangle-list",
    instanced: false,
    skinned: false,
    morphed: false,
    ...overrides,
  };
}

function pickPipelineDevice() {
  return {
    createShaderModule: () => ({
      compilationInfo: async () => ({ messages: [] }),
    }),
    createBindGroupLayout: (descriptor: unknown) => ({ descriptor }),
    createPipelineLayout: (descriptor: unknown) => ({ descriptor }),
    createRenderPipeline: (descriptor: unknown) => ({ descriptor }),
  };
}

function pickPipeline(
  overrides: Partial<WebGpuIdBufferPickPipelineResource>,
): WebGpuIdBufferPickPipelineResource {
  return {
    cacheKey: "pick-pipeline",
    shaderModule: "pick-shader-module",
    pipeline: "pick-pipeline-handle",
    descriptor: { label: "pick-pipeline" },
    layouts: {
      view: "pick-view-layout",
      worldTransforms: "pick-world-layout",
      ids: "pick-ids-layout",
    },
    ...overrides,
  };
}

function pickIdStorage(): WebGpuIdBufferPickIdStorageResource {
  return {
    resourceKey: "id-buffer-pick/ids",
    buffer: "ids-buffer",
    ids: new Uint32Array([WEBGPU_ID_BUFFER_EMPTY_ID]),
  };
}

function pickReadbackDevice(buffer: {
  readonly mapAsync?: (mode: number) => Promise<void>;
  readonly getMappedRange?: () => ArrayBuffer | ArrayBufferView;
  readonly unmap?: () => void;
}): WebGpuIdBufferPickReadbackDeviceLike {
  return {
    queue: { submit: () => {} },
    createCommandEncoder: () => ({
      copyTextureToBuffer: () => {},
      finish: () => ({}),
    }),
    createBuffer: () => buffer,
  };
}

function pickMeshDraw(options: {
  readonly renderId: number;
  readonly entity: { readonly index: number; readonly generation: number };
  readonly worldTransformOffset: number;
}) {
  return {
    renderId: options.renderId,
    entity: options.entity,
    mesh: createMeshHandle("mesh"),
    material: createMaterialHandle("material"),
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset: options.worldTransformOffset,
    boundsIndex: 0,
    layerMask: 1,
    sortKey: {
      queue: "opaque" as const,
      viewId: 0,
      layer: 0,
      order: 0,
      pipelineKey: "unlit|opaque",
      materialKey: "material:material",
      meshKey: "mesh:mesh",
      depth: 0,
      stableId: options.renderId,
    },
    batchKey: pickBatchKey({}),
  };
}
