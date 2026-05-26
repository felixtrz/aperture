import { describe, expect, it } from "vitest";

import {
  assembleFrameBoundary,
  createRenderBundleCache,
  createRenderBundleCommandKey,
  type RenderPassCommand,
} from "@aperture-engine/webgpu";

describe("frame boundary assembly helper", () => {
  it("assembles an all-ready injected frame boundary", () => {
    const events: string[] = [];
    const report = assembleFrameBoundary({
      context: contextWithView({ label: "view" }),
      device: device(events),
      queue: { submit: (buffers) => events.push(`submit:${buffers.length}`) },
      commands: [drawCommand()],
      label: "frame",
      clearColor: [0, 0, 0, 1],
    });

    expect(report.valid).toBe(true);
    expect(report.submit?.submitted).toBe(1);
    expect(events).toEqual(["begin", "draw", "end", "finish", "submit:1"]);
  });

  it("assembles an off-screen color target boundary", () => {
    const events: string[] = [];
    const offscreenTexture = {
      createView: () => {
        events.push("offscreen:view");
        return { label: "offscreen-view" };
      },
    };
    const report = assembleFrameBoundary({
      context: { getCurrentTexture: () => null },
      device: device(events),
      queue: { submit: (buffers) => events.push(`submit:${buffers.length}`) },
      commands: [drawCommand()],
      label: "offscreen-frame",
      colorTarget: {
        source: "offscreen-target",
        texture: offscreenTexture,
      },
      clearColor: [0.1, 0.2, 0.3, 1],
    });

    expect(report.valid).toBe(true);
    expect(report.texture.texture).toBe(offscreenTexture);
    expect(report.attachments?.plan?.colorAttachments[0]).toMatchObject({
      view: { label: "offscreen-view" },
      clearValue: { r: 0.1, g: 0.2, b: 0.3, a: 1 },
    });
    expect(events).toEqual([
      "offscreen:view",
      "begin",
      "draw",
      "end",
      "finish",
      "submit:1",
    ]);
  });

  it("assembles a multisampled color attachment that resolves into the presented target", () => {
    const events: string[] = [];
    const passDescriptors: unknown[] = [];
    const resolvedView = { label: "resolved-view" };
    const msaaView = { label: "msaa-view" };
    const report = assembleFrameBoundary({
      context: contextWithView(resolvedView),
      device: device(events, { passDescriptors }),
      queue: { submit: (buffers) => events.push(`submit:${buffers.length}`) },
      commands: [drawCommand()],
      label: "msaa-frame",
      clearColor: [0, 0, 0, 1],
      msaaColorTarget: {
        view: msaaView,
        sampleCount: 4,
      },
    });

    expect(report.valid).toBe(true);
    expect(report.attachments?.plan?.colorAttachments[0]).toMatchObject({
      view: msaaView,
      resolveTarget: resolvedView,
      storeOp: "discard",
    });
    expect(passDescriptors[0]).toBe(report.attachments?.plan);
  });

  it("can store a multisampled color attachment for a later load", () => {
    const events: string[] = [];
    const resolvedView = { label: "resolved-view" };
    const msaaView = { label: "msaa-view" };
    const report = assembleFrameBoundary({
      context: contextWithView(resolvedView),
      device: device(events),
      queue: { submit: (buffers) => events.push(`submit:${buffers.length}`) },
      commands: [drawCommand()],
      label: "msaa-store-frame",
      colorLoadOp: "load",
      msaaColorStoreOp: "store",
      msaaColorTarget: {
        view: msaaView,
        sampleCount: 4,
      },
    });

    expect(report.valid).toBe(true);
    expect(report.attachments?.plan?.colorAttachments[0]).toMatchObject({
      view: msaaView,
      resolveTarget: resolvedView,
      loadOp: "load",
      storeOp: "store",
    });
  });

  it("can load an existing color attachment instead of clearing it", () => {
    const events: string[] = [];
    const report = assembleFrameBoundary({
      context: contextWithView({ label: "view" }),
      device: device(events),
      queue: { submit: (buffers) => events.push(`submit:${buffers.length}`) },
      commands: [drawCommand()],
      label: "load-frame",
      colorLoadOp: "load",
    });

    expect(report.valid).toBe(true);
    expect(report.attachments?.plan?.colorAttachments[0]).toMatchObject({
      loadOp: "load",
      storeOp: "store",
    });
    expect(report.attachments?.plan?.colorAttachments[0]).not.toHaveProperty(
      "clearValue",
    );
  });

  it("assembles an additional color target for MRT scene outputs", () => {
    const events: string[] = [];
    const motionView = { label: "motion-view" };
    const report = assembleFrameBoundary({
      context: contextWithView({ label: "scene-view" }),
      device: device(events),
      queue: { submit: (buffers) => events.push(`submit:${buffers.length}`) },
      commands: [drawCommand()],
      label: "mrt-frame",
      clearColor: [0, 0, 0, 1],
      additionalColorTargets: [
        {
          view: motionView,
          clearColor: [0.5, 0.5, 0.5, 1],
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    expect(report.valid).toBe(true);
    expect(report.attachments?.plan?.colorAttachments).toMatchObject([
      { view: { label: "scene-view" } },
      {
        view: motionView,
        clearValue: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
      },
    ]);
  });

  it("applies viewport and scissor rectangles before draw commands", () => {
    const events: string[] = [];
    const report = assembleFrameBoundary({
      context: contextWithView({ label: "view" }),
      device: device(events),
      queue: { submit: (buffers) => events.push(`submit:${buffers.length}`) },
      commands: [drawCommand()],
      label: "viewport-frame",
      viewport: { x: 10, y: 20, width: 300, height: 200 },
      scissor: { x: 12, y: 22, width: 280, height: 180 },
    });

    expect(report.valid).toBe(true);
    expect(report.rectangle).toMatchObject({
      valid: true,
      viewport: { x: 10, y: 20, width: 300, height: 200 },
      scissor: { x: 12, y: 22, width: 280, height: 180 },
      diagnostics: [],
    });
    expect(events).toEqual([
      "begin",
      "viewport:10,20,300,200,0,1",
      "scissor:12,22,280,180",
      "draw",
      "end",
      "finish",
      "submit:1",
    ]);
  });

  it("attaches, executes, and resolves occlusion query resources", () => {
    const events: string[] = [];
    const passDescriptors: unknown[] = [];
    const querySet = { label: "query-set" };
    const resolveBuffer = { label: "resolve-buffer", mapAsync: async () => {} };
    const readbackBuffer = {
      label: "readback-buffer",
      mapAsync: async () => {},
    };
    const report = assembleFrameBoundary({
      context: contextWithView({ label: "view" }),
      device: device(events, { passDescriptors }),
      queue: { submit: (buffers) => events.push(`submit:${buffers.length}`) },
      commands: [
        { kind: "beginOcclusionQuery", renderId: 1, queryIndex: 0 },
        drawCommand(),
        { kind: "endOcclusionQuery", renderId: 1, queryIndex: 0 },
      ],
      label: "occlusion-frame",
      occlusionQueries: {
        queryCount: 1,
        resources: {
          label: "occlusion",
          queryCount: 1,
          byteLength: 8,
          querySet,
          resolveBuffer,
          readbackBuffer,
        },
      },
    });

    expect(report.valid).toBe(true);
    expect(report.attachments?.plan?.occlusionQuerySet).toBe(querySet);
    expect(report.occlusionQueries).toEqual({ valid: true, diagnostics: [] });
    expect(passDescriptors[0]).toBe(report.attachments?.plan);
    expect(events).toEqual([
      "begin",
      "beginOcclusionQuery:0",
      "draw",
      "endOcclusionQuery",
      "end",
      "resolveQuerySet:1",
      "copyBufferToBuffer:8",
      "finish",
      "submit:1",
    ]);
  });

  it("stops at texture view acquisition failures", () => {
    const report = assembleFrameBoundary({
      context: { getCurrentTexture: () => ({}) },
      device: device([]),
      queue: { submit: () => {} },
      commands: [drawCommand()],
      label: "frame",
    });

    expect(report.valid).toBe(false);
    expect(report.texture.diagnostics).toMatchObject([
      { code: "currentTextureView.missingTextureView" },
    ]);
    expect(report.attachments).toBeNull();
  });

  it("stops at begin render pass failures", () => {
    const report = assembleFrameBoundary({
      context: contextWithView({}),
      device: { createCommandEncoder: () => ({ finish: () => ({}) }) },
      queue: { submit: () => {} },
      commands: [drawCommand()],
      label: "frame",
    });

    expect(report.valid).toBe(false);
    expect(report.begin?.diagnostics).toMatchObject([
      { code: "renderPassLifecycle.missingBeginRenderPass" },
    ]);
    expect(report.execution).toBeNull();
  });

  it("reports command execution failures", () => {
    const report = assembleFrameBoundary({
      context: contextWithView({}),
      device: device([], { omitDraw: true }),
      queue: { submit: () => {} },
      commands: [drawCommand()],
      label: "frame",
    });

    expect(report.valid).toBe(false);
    expect(report.execution?.diagnostics).toMatchObject([
      { code: "renderPassCommandExecutor.missingMethod", method: "draw" },
    ]);
  });

  it("reports finish and submit failures", () => {
    const finishFailure = assembleFrameBoundary({
      context: contextWithView({}),
      device: {
        createCommandEncoder: () => ({
          beginRenderPass: () => ({ draw: () => {}, end: () => {} }),
        }),
      },
      queue: { submit: () => {} },
      commands: [drawCommand()],
      label: "frame",
    });
    const submitFailure = assembleFrameBoundary({
      context: contextWithView({}),
      device: device([]),
      queue: {},
      commands: [drawCommand()],
      label: "frame",
    });

    expect(finishFailure.finish?.diagnostics).toMatchObject([
      { code: "commandBuffer.missingFinish" },
    ]);
    expect(submitFailure.submit?.diagnostics).toMatchObject([
      { code: "queueSubmit.missingSubmit" },
    ]);
  });

  it("creates and reuses render bundles for matching static command plans", () => {
    const events: string[] = [];
    const cache = createRenderBundleCache();
    const renderBundle = {
      cache,
      key: "static-plane",
      descriptor: {
        colorFormats: ["bgra8unorm"],
        depthStencilFormat: "depth24plus",
        sampleCount: 1,
      },
    };

    const first = assembleFrameBoundary({
      context: contextWithView({ label: "view" }),
      device: renderBundleDevice(events),
      queue: { submit: (buffers) => events.push(`submit:${buffers.length}`) },
      commands: [drawCommand()],
      label: "frame",
      renderBundle,
    });
    const second = assembleFrameBoundary({
      context: contextWithView({ label: "view" }),
      device: renderBundleDevice(events),
      queue: { submit: (buffers) => events.push(`submit:${buffers.length}`) },
      commands: [drawCommand()],
      label: "frame",
      renderBundle,
    });

    expect(first.valid).toBe(true);
    expect(first.execution).toMatchObject({
      commandCount: 1,
      executedCommands: 1,
      drawCalls: 1,
    });
    expect(first.renderBundle).toMatchObject({
      status: "created",
      encodedCommands: 1,
      executedBundles: 1,
      drawCalls: 1,
    });
    expect(second.valid).toBe(true);
    expect(second.renderBundle).toMatchObject({
      status: "reused",
      encodedCommands: 0,
      executedBundles: 1,
      drawCalls: 1,
    });
    expect(events).toEqual([
      "begin",
      "bundle:create:frame:bundle",
      "bundle:draw",
      "bundle:finish",
      "executeBundles:1",
      "end",
      "finish",
      "submit:1",
      "begin",
      "executeBundles:1",
      "end",
      "finish",
      "submit:1",
    ]);
  });

  it("falls back to direct command execution when render bundles are unsupported", () => {
    const events: string[] = [];
    const report = assembleFrameBoundary({
      context: contextWithView({ label: "view" }),
      device: device(events),
      queue: { submit: (buffers) => events.push(`submit:${buffers.length}`) },
      commands: [drawCommand()],
      label: "frame",
      renderBundle: {
        cache: createRenderBundleCache(),
        key: "static-plane",
        descriptor: { colorFormats: ["bgra8unorm"] },
      },
    });

    expect(report.valid).toBe(true);
    expect(report.renderBundle).toMatchObject({
      status: "unsupported",
      encodedCommands: 1,
      executedBundles: 0,
      drawCalls: 1,
    });
    expect(events).toEqual(["begin", "draw", "end", "finish", "submit:1"]);
  });

  it("keys bind group bundle compatibility by resource key instead of wrapper identity", () => {
    const cache = createRenderBundleCache();
    const first = createRenderBundleCommandKey(
      {
        targetKey: "swapchain",
        colorFormats: ["bgra8unorm"],
        commands: [
          {
            kind: "setBindGroup",
            renderId: 1,
            index: 0,
            resourceKey: "bind-group:view-buffer",
            bindGroup: { frame: 1 },
          },
          drawCommand(),
        ],
      },
      cache,
    );
    const second = createRenderBundleCommandKey(
      {
        targetKey: "swapchain",
        colorFormats: ["bgra8unorm"],
        commands: [
          {
            kind: "setBindGroup",
            renderId: 1,
            index: 0,
            resourceKey: "bind-group:view-buffer",
            bindGroup: { frame: 2 },
          },
          drawCommand(),
        ],
      },
      cache,
    );

    expect(second).toBe(first);
  });
});

function contextWithView(view: unknown) {
  return {
    getCurrentTexture: () => ({
      createView: () => view,
    }),
  };
}

function device(
  events: string[],
  options: {
    readonly omitDraw?: boolean;
    readonly passDescriptors?: unknown[];
  } = {},
) {
  return {
    createCommandEncoder: () => ({
      beginRenderPass: (descriptor: unknown) => {
        options.passDescriptors?.push(descriptor);
        events.push("begin");
        return {
          setViewport: (
            x: number,
            y: number,
            width: number,
            height: number,
            minDepth: number,
            maxDepth: number,
          ) =>
            events.push(
              `viewport:${x},${y},${width},${height},${minDepth},${maxDepth}`,
            ),
          setScissorRect: (
            x: number,
            y: number,
            width: number,
            height: number,
          ) => events.push(`scissor:${x},${y},${width},${height}`),
          ...(options.omitDraw ? {} : { draw: () => events.push("draw") }),
          beginOcclusionQuery: (queryIndex: number) =>
            events.push(`beginOcclusionQuery:${queryIndex}`),
          endOcclusionQuery: () => events.push("endOcclusionQuery"),
          end: () => events.push("end"),
        };
      },
      resolveQuerySet: (
        _querySet: unknown,
        _firstQuery: number,
        queryCount: number,
      ) => events.push(`resolveQuerySet:${queryCount}`),
      copyBufferToBuffer: (
        _source: unknown,
        _sourceOffset: number,
        _destination: unknown,
        _destinationOffset: number,
        size: number,
      ) => events.push(`copyBufferToBuffer:${size}`),
      finish: () => {
        events.push("finish");
        return { label: "command-buffer" };
      },
    }),
  };
}

function renderBundleDevice(events: string[]) {
  return {
    createRenderBundleEncoder: (descriptor: { readonly label?: string }) => {
      events.push(`bundle:create:${descriptor.label ?? "unlabeled"}`);

      return {
        draw: () => events.push("bundle:draw"),
        finish: () => {
          events.push("bundle:finish");
          return { label: "render-bundle" };
        },
      };
    },
    createCommandEncoder: () => ({
      beginRenderPass: () => {
        events.push("begin");
        return {
          executeBundles: (bundles: readonly unknown[]) =>
            events.push(`executeBundles:${bundles.length}`),
          end: () => events.push("end"),
        };
      },
      finish: () => {
        events.push("finish");
        return { label: "command-buffer" };
      },
    }),
  };
}

function drawCommand(): RenderPassCommand {
  return {
    kind: "draw",
    renderId: 1,
    vertexCount: 3,
    instanceCount: 1,
    firstVertex: 0,
    firstInstance: 0,
  };
}
