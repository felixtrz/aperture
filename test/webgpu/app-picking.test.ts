import { describe, expect, it } from "vitest";

import * as webgpu from "@aperture-engine/webgpu/test-support";
import {
  createMaterialHandle,
  createMeshHandle,
  createWebGpuIdBufferPickCommands,
  createWebGpuRenderPipelineCacheKey,
  resolveDrawCommandPipelineKey,
  type BatchCompatibilityKey,
  type RenderPassCommand,
  type RenderSnapshot,
} from "@aperture-engine/webgpu/test-support";
import {
  createWebGpuAppPickSharedBindGroups,
  getOrCreateWebGpuIdBufferPickPipelines,
  popWebGpuPickErrorScope,
  pushWebGpuPickErrorScope,
  webGpuAppPickPixel,
} from "../../packages/webgpu/src/app/picking.js";
import type {
  WebGpuIdBufferPickDiagnostic,
  WebGpuIdBufferPickPipelineResource,
} from "../../packages/webgpu/src/picking/id-buffer-pick.js";

describe("WebGPU app picking helpers", () => {
  it("floors finite canvas coordinates and rejects out-of-bounds picks", () => {
    expect(webGpuAppPickPixel({ width: 8, height: 4 }, 2.9, 1.1)).toEqual({
      x: 2,
      y: 1,
    });
    expect(webGpuAppPickPixel({ width: 8, height: 4 }, -1, 1)).toBeNull();
    expect(webGpuAppPickPixel({ width: 8, height: 4 }, 8, 1)).toBeNull();
    expect(webGpuAppPickPixel({ width: 8, height: 4 }, 1, 4)).toBeNull();
    expect(
      webGpuAppPickPixel({ width: 8, height: 4 }, Number.NaN, 1),
    ).toBeNull();
  });

  it("creates shared pick bind groups from pipeline layouts", () => {
    const descriptors: unknown[] = [];
    const device = {
      createBindGroup: (descriptor: unknown) => {
        descriptors.push(descriptor);
        return `bind-group:${descriptors.length}`;
      },
    };
    const pipeline = pickPipeline();

    const result = createWebGpuAppPickSharedBindGroups({
      device,
      pipeline,
      viewUniformBuffer: "view-buffer",
      worldTransformBuffer: "transform-buffer",
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.viewBindGroup).toMatchObject({
      group: 0,
      resourceKey: "id-buffer-pick/view",
      bindGroup: "bind-group:1",
    });
    expect(result.worldTransformBindGroup).toMatchObject({
      group: 1,
      resourceKey: "id-buffer-pick/world-transforms",
      bindGroup: "bind-group:2",
    });
    expect(descriptors).toEqual([
      expect.objectContaining({ layout: "view-layout" }),
      expect.objectContaining({ layout: "world-layout" }),
    ]);
  });

  it("diagnoses missing pick bind group support", () => {
    const result = createWebGpuAppPickSharedBindGroups({
      device: {},
      pipeline: pickPipeline(),
      viewUniformBuffer: "view-buffer",
      worldTransformBuffer: "transform-buffer",
    });

    expect(result.valid).toBe(false);
    expect(result.viewBindGroup.bindGroup).toBeNull();
    expect(result.worldTransformBindGroup.bindGroup).toBeNull();
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "webGpuApp.pickCreateBindGroupUnavailable",
      }),
    ]);
  });

  it("keeps diagnostic error scopes best-effort", async () => {
    const events: string[] = [];
    const scoped = {
      pushErrorScope: (filter: "validation") => {
        events.push(`push:${filter}`);
      },
      popErrorScope: async () => ({ message: "validation failed" }),
    };

    pushWebGpuPickErrorScope(scoped);

    await expect(popWebGpuPickErrorScope(scoped)).resolves.toBe(
      "validation failed",
    );
    await expect(popWebGpuPickErrorScope({})).resolves.toBeNull();
    expect(() =>
      pushWebGpuPickErrorScope({
        pushErrorScope: () => {
          throw new Error("scope unavailable");
        },
      }),
    ).not.toThrow();
    expect(events).toEqual(["push:validation"]);
  });

  it("keeps app picking helpers off the public WebGPU package surface", () => {
    expect("webGpuAppPickPixel" in webgpu).toBe(false);
    expect("createWebGpuAppPickSharedBindGroups" in webgpu).toBe(false);
  });

  it("keys prepared pick pipelines by the resolved draw-command pipeline key", async () => {
    const batchKey: BatchCompatibilityKey = {
      pipelineKey: "unlit|opaque|back|less|none",
      materialKey: "material:pick-triangle",
      meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0",
      topology: "triangle-list",
      instanced: false,
      skinned: false,
      morphed: false,
    };
    // The frame plan records the prepared GPU pipeline's resolved cache key
    // (the JSON key-format contract), not the authored batch pipeline key.
    const resolvedPipelineKey = createWebGpuRenderPipelineCacheKey({
      shaderLabel: "aperture/unlit-mesh",
      shaderFamily: "unlit",
      shaderVariantKey: "baseColorFactor",
      colorFormats: ["rgba8unorm"],
      depthFormat: "depth24plus",
      batchKey,
    });
    const snapshot = createPickPipelineSnapshot([
      { renderId: 1, batchKey },
      { renderId: 2, batchKey },
    ]);
    const pipelineKeysByRenderId = new Map<number, string>([
      [1, resolvedPipelineKey],
      [2, resolvedPipelineKey],
    ]);
    const cache = {
      idPickPipelines: new Map<string, WebGpuIdBufferPickPipelineResource>(),
    };

    const prepared = await getOrCreateWebGpuIdBufferPickPipelines({
      app: { initialization: { device: createPickPipelineDevice() } },
      cache,
      snapshot,
      pipelineKeysByRenderId,
    });

    expect(prepared.diagnostics).toEqual([]);
    expect(prepared.valid).toBe(true);
    // One pick pipeline per batch key in the device cache, looked up under the
    // command-level key the frame plan emits.
    expect(cache.idPickPipelines.size).toBe(1);
    expect([...prepared.pipelines.keys()]).toEqual([resolvedPipelineKey]);

    // Rewriting the frame plan's commands (which carry the resolved key via
    // resolveDrawCommandPipelineKey) must find every pick pipeline.
    const commands: RenderPassCommand[] = snapshot.meshDraws.flatMap((draw) => [
      {
        kind: "setPipeline",
        renderId: draw.renderId,
        pipelineKey: resolveDrawCommandPipelineKey(
          draw.renderId,
          draw.batchKey.pipelineKey,
          pipelineKeysByRenderId,
        ),
        pipeline: "color-pipeline",
      },
      {
        kind: "draw",
        renderId: draw.renderId,
        vertexCount: 3,
        instanceCount: 1,
        firstVertex: 0,
        firstInstance: 0,
      },
    ]);
    const rewritten = createWebGpuIdBufferPickCommands({
      commands,
      pipelineByKey: prepared.pipelines,
      viewBindGroup: {
        group: 0,
        resourceKey: "id-buffer-pick/view",
        bindGroup: "pick-view-bind-group",
      },
      worldTransformBindGroup: {
        group: 1,
        resourceKey: "id-buffer-pick/world-transforms",
        bindGroup: "pick-world-bind-group",
      },
      idBindGroup: {
        group: 2,
        resourceKey: "id-buffer-pick/ids",
        bindGroup: "id-bind-group",
      },
    });

    expect(
      rewritten.diagnostics.filter(
        (diagnostic: WebGpuIdBufferPickDiagnostic) =>
          diagnostic.code === "idBufferPick.missingPickPipeline",
      ),
    ).toEqual([]);
    expect(rewritten.valid).toBe(true);
  });

  it("keys pick pipelines by the authored key when no resolved keys exist", async () => {
    const batchKey: BatchCompatibilityKey = {
      pipelineKey: "unlit|opaque",
      materialKey: "material:pick-triangle",
      meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0",
      topology: "triangle-list",
      instanced: false,
      skinned: false,
      morphed: false,
    };
    const snapshot = createPickPipelineSnapshot([{ renderId: 7, batchKey }]);

    const prepared = await getOrCreateWebGpuIdBufferPickPipelines({
      app: { initialization: { device: createPickPipelineDevice() } },
      cache: {
        idPickPipelines: new Map<string, WebGpuIdBufferPickPipelineResource>(),
      },
      snapshot,
    });

    expect(prepared.valid).toBe(true);
    expect([...prepared.pipelines.keys()]).toEqual([
      resolveDrawCommandPipelineKey(7, batchKey.pipelineKey),
    ]);
    expect([...prepared.pipelines.keys()]).toEqual([batchKey.pipelineKey]);
  });
});

function createPickPipelineDevice(): Parameters<
  typeof getOrCreateWebGpuIdBufferPickPipelines
>[0]["app"]["initialization"]["device"] {
  return {
    createShaderModule: () => ({
      compilationInfo: async () => ({ messages: [] }),
    }),
    createBindGroupLayout: (descriptor: unknown) => ({ descriptor }),
    createPipelineLayout: (descriptor: unknown) => ({ descriptor }),
    createRenderPipeline: () => ({ kind: "render-pipeline" }),
  };
}

function createPickPipelineSnapshot(
  draws: readonly {
    readonly renderId: number;
    readonly batchKey: BatchCompatibilityKey;
  }[],
): Pick<RenderSnapshot, "meshDraws"> {
  return {
    meshDraws: draws.map((draw) => ({
      renderId: draw.renderId,
      entity: { index: draw.renderId, generation: 0 },
      mesh: createMeshHandle("pick-mesh"),
      material: createMaterialHandle("pick-material"),
      submesh: 0,
      materialSlot: 0,
      worldTransformOffset: 0,
      boundsIndex: 0,
      layerMask: 1,
      sortKey: {
        queue: "opaque",
        viewId: 0,
        layer: 0,
        order: 0,
        pipelineKey: draw.batchKey.pipelineKey,
        materialKey: draw.batchKey.materialKey,
        meshKey: "mesh:pick-mesh",
        depth: 0,
        stableId: draw.renderId,
      },
      batchKey: draw.batchKey,
    })),
  };
}

function pickPipeline(): WebGpuIdBufferPickPipelineResource {
  return {
    cacheKey: "pick-pipeline",
    shaderModule: "shader-module",
    pipeline: "pipeline",
    descriptor: { label: "pick-pipeline" },
    layouts: {
      view: "view-layout",
      worldTransforms: "world-layout",
      ids: "ids-layout",
    },
  };
}
