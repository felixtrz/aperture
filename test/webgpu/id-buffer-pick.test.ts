import { describe, expect, it } from "vitest";

import type { RenderSnapshot } from "@aperture-engine/render";
import {
  createWebGpuIdBufferEntries,
  createWebGpuIdBufferIdForEntity,
  createWebGpuIdBufferPickCommands,
  createWebGpuIdBufferPickIdStorageValues,
  createMaterialHandle,
  createMeshHandle,
  WEBGPU_ID_BUFFER_EMPTY_ID,
  type WebGpuIdBufferPickPipelineResource,
} from "@aperture-engine/webgpu";

describe("WebGPU ID-buffer picking", () => {
  it("packs ECS-derived pick IDs by world-transform slot", () => {
    const first = { index: 7, generation: 1 };
    const second = { index: 8, generation: 2 };
    const snapshot = createPickSnapshot([
      {
        renderId: 1,
        entity: first,
        worldTransformOffset: 0,
      },
      {
        renderId: 2,
        entity: second,
        worldTransformOffset: 32,
      },
    ]);

    const ids = createWebGpuIdBufferPickIdStorageValues(snapshot);

    expect(Array.from(ids)).toEqual([
      createWebGpuIdBufferIdForEntity(first),
      WEBGPU_ID_BUFFER_EMPTY_ID,
      createWebGpuIdBufferIdForEntity(second),
    ]);
    expect(createWebGpuIdBufferEntries(snapshot.meshDraws)).toHaveLength(2);
  });

  it("rewrites color-pass commands to an ID-buffer pass", () => {
    const pickPipeline = createPickPipeline("pick-pipeline");
    const rewritten = createWebGpuIdBufferPickCommands({
      pipelineByKey: new Map([["unlit|opaque", pickPipeline]]),
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
      commands: [
        {
          kind: "setPipeline",
          renderId: 1,
          pipelineKey: "unlit|opaque",
          pipeline: "color-pipeline",
        },
        {
          kind: "setBindGroup",
          renderId: 1,
          index: 0,
          resourceKey: "view",
          bindGroup: "view-bind-group",
        },
        {
          kind: "setBindGroup",
          renderId: 1,
          index: 2,
          resourceKey: "material",
          bindGroup: "material-bind-group",
        },
        {
          kind: "setVertexBuffer",
          renderId: 1,
          slot: 0,
          resourceKey: "mesh/vertices",
          buffer: "vertex-buffer",
        },
        {
          kind: "draw",
          renderId: 1,
          vertexCount: 3,
          instanceCount: 1,
          firstVertex: 0,
          firstInstance: 0,
        },
      ],
    });

    expect(rewritten.valid).toBe(true);
    expect(rewritten.commands).toEqual([
      {
        kind: "setPipeline",
        renderId: 1,
        pipelineKey: "pick-pipeline",
        pipeline: "pick-pipeline-handle",
      },
      {
        kind: "setVertexBuffer",
        renderId: 1,
        slot: 0,
        resourceKey: "mesh/vertices",
        buffer: "vertex-buffer",
      },
      {
        kind: "setBindGroup",
        renderId: 1,
        index: 0,
        resourceKey: "id-buffer-pick/view",
        bindGroup: "pick-view-bind-group",
      },
      {
        kind: "setBindGroup",
        renderId: 1,
        index: 1,
        resourceKey: "id-buffer-pick/world-transforms",
        bindGroup: "pick-world-bind-group",
      },
      {
        kind: "setBindGroup",
        renderId: 1,
        index: 2,
        resourceKey: "id-buffer-pick/ids",
        bindGroup: "id-bind-group",
      },
      {
        kind: "draw",
        renderId: 1,
        vertexCount: 3,
        instanceCount: 1,
        firstVertex: 0,
        firstInstance: 0,
      },
    ]);
  });
});

function createPickSnapshot(
  draws: readonly {
    readonly renderId: number;
    readonly entity: { readonly index: number; readonly generation: number };
    readonly worldTransformOffset: number;
  }[],
): Pick<RenderSnapshot, "meshDraws" | "transforms"> {
  return {
    transforms: new Float32Array(48),
    meshDraws: draws.map((draw) => ({
      renderId: draw.renderId,
      entity: draw.entity,
      mesh: createMeshHandle("mesh"),
      material: createMaterialHandle("material"),
      submesh: 0,
      materialSlot: 0,
      worldTransformOffset: draw.worldTransformOffset,
      boundsIndex: 0,
      layerMask: 1,
      sortKey: {
        queue: "opaque",
        viewId: 0,
        layer: 0,
        order: 0,
        pipelineKey: "unlit|opaque",
        materialKey: "material:material",
        meshKey: "mesh:mesh",
        depth: 0,
        stableId: draw.renderId,
      },
      batchKey: {
        pipelineKey: "unlit|opaque",
        materialKey: "material:material",
        meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0",
        topology: "triangle-list",
        instanced: false,
        skinned: false,
        morphed: false,
      },
    })),
  };
}

function createPickPipeline(
  cacheKey: string,
): WebGpuIdBufferPickPipelineResource {
  return {
    cacheKey,
    shaderModule: "pick-shader-module",
    pipeline: "pick-pipeline-handle",
    layouts: {
      view: "pick-view-layout",
      worldTransforms: "pick-world-layout",
      ids: "pick-ids-layout",
    },
    descriptor: {
      layout: "auto",
      vertex: {
        module: "pick-shader-module",
        entryPoint: "vs_main",
      },
      fragment: {
        module: "pick-shader-module",
        entryPoint: "fs_main",
        targets: [{ format: "r32uint" }],
      },
      primitive: { topology: "triangle-list" },
    },
  };
}
