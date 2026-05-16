import { describe, expect, it } from "vitest";

import {
  createBoxMeshAsset,
  createRenderAssetCollections,
  createUnlitMaterialAsset,
  withCamera,
  withMaterial,
  withMesh,
  withRenderLayer,
  withTransform,
  withVisibility,
} from "@aperture-engine/core";
import { createWebGpuApp } from "@aperture-engine/webgpu";

describe("WebGPU app facade", () => {
  it("initializes WebGPU and renders the existing unlit path from ECS-authored entities", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "Cube" }));
    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "White" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 11);

    expect(frame.ok).toBe(true);
    expect(frame.frame).toBe(11);
    expect(frame.counts).toMatchObject({
      views: 1,
      meshDraws: 1,
      drawPackages: 1,
      drawCalls: 1,
      diagnostics: 0,
    });
    expect(events).toContain("context:configure:bgra8unorm");
    expect(events).toContain("queue:submit:1");
    expect(events.some((event) => event.startsWith("pass:draw"))).toBe(true);
  });
});

function webGpuHarness(events: string[]) {
  const device = {
    queue: {
      writeBuffer: () => {
        events.push("queue:writeBuffer");
      },
      submit: (buffers: readonly unknown[]) => {
        events.push(`queue:submit:${buffers.length}`);
      },
      onSubmittedWorkDone: async () => {
        events.push("queue:done");
      },
    },
    lost: new Promise<never>(() => {}),
    createShaderModule: (descriptor: unknown) => {
      events.push("device:shader");
      return { descriptor, compilationInfo: async () => ({ messages: [] }) };
    },
    createRenderPipeline: (descriptor: unknown) => {
      events.push("device:pipeline");
      return {
        descriptor,
        getBindGroupLayout: (group: number) => ({ group }),
      };
    },
    createBuffer: (descriptor: unknown) => {
      events.push("device:buffer");
      return { descriptor };
    },
    createBindGroup: (descriptor: unknown) => {
      events.push("device:bindGroup");
      return { descriptor };
    },
    createCommandEncoder: () => {
      events.push("device:encoder");
      return {
        beginRenderPass: () => {
          events.push("encoder:begin");
          return {
            setPipeline: () => events.push("pass:pipeline"),
            setBindGroup: (group: number) => events.push(`pass:bind:${group}`),
            setVertexBuffer: (slot: number) =>
              events.push(`pass:vertex:${slot}`),
            setIndexBuffer: () => events.push("pass:index"),
            draw: (vertexCount: number) =>
              events.push(`pass:draw:${vertexCount}`),
            drawIndexed: (indexCount: number) =>
              events.push(`pass:drawIndexed:${indexCount}`),
            end: () => events.push("pass:end"),
          };
        },
        finish: () => {
          events.push("encoder:finish");
          return { commandBuffer: true };
        },
      };
    },
  };
  const context = {
    configure: (configuration: { readonly format: string }) =>
      events.push(`context:configure:${configuration.format}`),
    getCurrentTexture: () => ({
      createView: () => {
        events.push("texture:view");
        return { view: true };
      },
    }),
  };
  const canvas = {
    getContext: (contextId: "webgpu") => {
      events.push(`canvas:context:${contextId}`);
      return context;
    },
  };
  const environment = {
    navigator: {
      gpu: {
        requestAdapter: async () => ({
          requestDevice: async () => device,
        }),
        getPreferredCanvasFormat: () => "bgra8unorm",
      },
    },
  };

  return { canvas, environment };
}
