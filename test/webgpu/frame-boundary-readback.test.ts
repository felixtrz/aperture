import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assembleFrameBoundary,
  mapFrameBoundaryReadbackSamples,
  type AssembleFrameBoundaryOptions,
  type FrameBoundaryReadbackBufferLike,
  type RenderPassCommand,
} from "@aperture-engine/webgpu/test-support";

describe("frame boundary readback and pass rectangle diagnostics", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("copies requested samples into readback buffers and decodes BGRA pixels", async () => {
    stubReadbackGlobals();

    const events: string[] = [];
    const copies: unknown[][] = [];
    const bufferDescriptors: { label?: string; size?: number }[] = [];
    const buffer: FrameBoundaryReadbackBufferLike = {
      mapAsync: async (mode: number) => {
        events.push(`mapAsync:${mode}`);
      },
      getMappedRange: () => new Uint8Array([10, 20, 30, 255]).buffer,
      unmap: () => {
        events.push("unmap");
      },
    };
    const report = assembleFrameBoundary({
      context: contextWithView({ label: "view" }),
      device: readbackDevice(events, {
        createBuffer: (descriptor) => {
          bufferDescriptors.push(
            descriptor as { label?: string; size?: number },
          );
          return buffer;
        },
        copyTextureToBuffer: (source, destination, copySize) => {
          events.push("copyTextureToBuffer");
          copies.push([source, destination, copySize]);
        },
      }),
      queue: { submit: (buffers) => events.push(`submit:${buffers.length}`) },
      commands: [drawCommand()],
      label: "readback-frame",
      readback: {
        format: "bgra8unorm",
        width: 8,
        height: 4,
        samples: [{ id: "center", x: 0.5, y: 0.5 }],
      },
    });

    expect(report.valid).toBe(true);
    expect(report.readback).toMatchObject({
      ok: true,
      source: "current-texture",
      format: "bgra8unorm",
      bytesPerRow: 256,
      mapModeRead: 1,
    });
    expect(bufferDescriptors).toEqual([
      { label: "aperture-center-readback", size: 256, usage: 9 },
    ]);
    expect(copies).toEqual([
      [
        { texture: report.texture.texture, origin: { x: 4, y: 2, z: 0 } },
        { buffer, bytesPerRow: 256, rowsPerImage: 1 },
        { width: 1, height: 1, depthOrArrayLayers: 1 },
      ],
    ]);
    expect(events).toEqual([
      "begin",
      "draw",
      "end",
      "copyTextureToBuffer",
      "finish",
      "submit:1",
    ]);

    const samples = await mapFrameBoundaryReadbackSamples(
      report.readback,
      report.valid,
    );

    expect(samples).toEqual({
      ok: true,
      source: "current-texture",
      format: "bgra8unorm",
      bytesPerRow: 256,
      samples: [
        {
          id: "center",
          origin: { x: 4, y: 2 },
          pixel: { r: 30, g: 20, b: 10, a: 255 },
        },
      ],
    });
    expect(events).toContain("mapAsync:1");
    expect(events).toContain("unmap");
  });

  it("decodes RGBA off-screen samples from mapped array views", async () => {
    stubReadbackGlobals();

    const report = assembleFrameBoundary({
      context: { getCurrentTexture: () => null },
      device: readbackDevice([], {
        createBuffer: () => ({
          mapAsync: async () => {},
          getMappedRange: () => new Uint8Array([10, 20, 30, 255]),
          unmap: () => {},
        }),
        copyTextureToBuffer: () => {},
      }),
      queue: { submit: () => {} },
      commands: [drawCommand()],
      label: "offscreen-readback",
      colorTarget: {
        source: "offscreen-target",
        texture: { createView: () => ({ label: "offscreen-view" }) },
      },
      readback: {
        format: "rgba8unorm",
        width: 4,
        height: 4,
        samples: [{ id: "corner", x: 0, y: 0 }],
      },
    });

    expect(report.readback).toMatchObject({
      ok: true,
      source: "offscreen-target",
      format: "rgba8unorm",
    });

    const samples = await mapFrameBoundaryReadbackSamples(
      report.readback,
      true,
    );

    expect(samples).toEqual({
      ok: true,
      source: "offscreen-target",
      format: "rgba8unorm",
      bytesPerRow: 256,
      samples: [
        {
          id: "corner",
          origin: { x: 0, y: 0 },
          pixel: { r: 10, g: 20, b: 30, a: 255 },
        },
      ],
    });
  });

  it("rejects texture formats it cannot decode and carries frame validity into clearOk", async () => {
    stubReadbackGlobals();

    const report = assembleReadbackBoundary({
      readback: {
        format: "r32uint",
        width: 4,
        height: 4,
        samples: [{ id: "center", x: 0.5, y: 0.5 }],
      },
    });

    expect(report.readback).toMatchObject({
      ok: false,
      reason: "unsupported-texture-format",
      clearOk: false,
    });

    const mapped = await mapFrameBoundaryReadbackSamples(report.readback, true);

    expect(mapped).toMatchObject({
      ok: false,
      reason: "unsupported-texture-format",
      clearOk: true,
    });
  });

  it("requires GPUBufferUsage flags for readback buffers", () => {
    const report = assembleReadbackBoundary({});

    expect(report.readback).toMatchObject({
      ok: false,
      reason: "buffer-usage-unavailable",
    });
  });

  it("requires GPUMapMode.READ for readback mapping", () => {
    vi.stubGlobal("GPUBufferUsage", { MAP_READ: 1, COPY_DST: 8 });

    const report = assembleReadbackBoundary({});

    expect(report.readback).toMatchObject({
      ok: false,
      reason: "map-mode-unavailable",
    });
  });

  it("requires device.createBuffer for readback buffers", () => {
    stubReadbackGlobals();

    const report = assembleReadbackBoundary({
      device: readbackDevice([], { copyTextureToBuffer: () => {} }),
    });

    expect(report.readback).toMatchObject({
      ok: false,
      reason: "create-buffer-unavailable",
    });
  });

  it("requires encoder.copyTextureToBuffer for readback copies", () => {
    stubReadbackGlobals();

    const report = assembleReadbackBoundary({
      device: readbackDevice([], { createBuffer: () => ({}) }),
    });

    expect(report.readback).toMatchObject({
      ok: false,
      reason: "copy-texture-to-buffer-unavailable",
      message: expect.stringContaining("current texture"),
    });
  });

  it("rejects samples outside the readback texture", () => {
    stubReadbackGlobals();

    const report = assembleReadbackBoundary({
      readback: {
        format: "bgra8unorm",
        width: 8,
        height: 4,
        samples: [{ id: "outside", x: 1.5, y: 0.5 }],
      },
    });

    expect(report.readback).toMatchObject({
      ok: false,
      reason: "texture-size-invalid",
      message: expect.stringContaining("'outside'"),
    });
  });

  it("reports readback buffer creation and texture copy failures", () => {
    stubReadbackGlobals();

    const createFailure = assembleReadbackBoundary({
      device: readbackDevice([], {
        createBuffer: () => {
          throw new Error("buffer exhausted");
        },
        copyTextureToBuffer: () => {},
      }),
    });
    const copyFailure = assembleReadbackBoundary({
      device: readbackDevice([], {
        createBuffer: () => ({}),
        copyTextureToBuffer: () => {
          throw new Error("copy rejected");
        },
      }),
    });

    expect(createFailure.readback).toMatchObject({
      ok: false,
      reason: "create-buffer-unavailable",
      message: expect.stringContaining("buffer exhausted"),
    });
    expect(copyFailure.readback).toMatchObject({
      ok: false,
      reason: "copy-texture-to-buffer-unavailable",
      message: expect.stringContaining("copy rejected"),
    });
  });

  it("reports unmappable readback buffers when decoding samples", async () => {
    stubReadbackGlobals();

    const withoutMapAsync = assembleReadbackBoundary({
      device: readbackDeviceWithBuffer({
        getMappedRange: () => new Uint8Array(4),
      }),
    });
    const withoutMappedRange = assembleReadbackBoundary({
      device: readbackDeviceWithBuffer({ mapAsync: async () => {} }),
    });

    expect(
      await mapFrameBoundaryReadbackSamples(withoutMapAsync.readback, true),
    ).toMatchObject({
      ok: false,
      reason: "map-read-unavailable",
      clearOk: true,
    });
    expect(
      await mapFrameBoundaryReadbackSamples(withoutMappedRange.readback, false),
    ).toMatchObject({
      ok: false,
      reason: "mapped-range-unavailable",
      clearOk: false,
    });
  });

  it("reports map and mapped-range failures while keeping unmap best-effort", async () => {
    stubReadbackGlobals();

    const mapRejects = assembleReadbackBoundary({
      device: readbackDeviceWithBuffer({
        mapAsync: async () => {
          throw new Error("device lost");
        },
        getMappedRange: () => new Uint8Array(4),
      }),
    });
    const rangeThrows = assembleReadbackBoundary({
      device: readbackDeviceWithBuffer({
        mapAsync: async () => {},
        getMappedRange: () => {
          throw new Error("range detached");
        },
        unmap: () => {
          throw new Error("unmap rejected");
        },
      }),
    });

    expect(
      await mapFrameBoundaryReadbackSamples(mapRejects.readback, true),
    ).toMatchObject({
      ok: false,
      reason: "readback-map-failed",
      message: expect.stringContaining("device lost"),
    });
    expect(
      await mapFrameBoundaryReadbackSamples(rangeThrows.readback, true),
    ).toMatchObject({
      ok: false,
      reason: "mapped-range-unavailable",
      message: expect.stringContaining("range detached"),
    });
  });

  it("ignores absent readback plans when mapping samples", async () => {
    expect(await mapFrameBoundaryReadbackSamples(null, true)).toBeUndefined();
    expect(
      await mapFrameBoundaryReadbackSamples(undefined, false),
    ).toBeUndefined();
  });

  it("reports occlusion resolve failures when no command encoder exists", () => {
    const report = assembleFrameBoundary({
      context: { getCurrentTexture: () => ({}) },
      device: {},
      queue: { submit: () => {} },
      commands: [drawCommand()],
      label: "occlusion-without-encoder",
      occlusionQueries: {
        queryCount: 1,
        resources: {
          label: "occlusion",
          queryCount: 1,
          byteLength: 8,
          querySet: {},
          resolveBuffer: {},
          readbackBuffer: {},
        },
      },
    });

    expect(report.valid).toBe(false);
    expect(report.occlusionQueries).toEqual({
      valid: false,
      diagnostics: [
        {
          code: "gpuOcclusion.commandEncodingUnsupported",
          severity: "error",
          message:
            "GPU occlusion query resolve requires a command encoder resource.",
        },
      ],
    });
  });

  it("rejects viewport rectangles without finite positive dimensions", () => {
    const events: string[] = [];
    const report = assembleFrameBoundary({
      context: contextWithView({ label: "view" }),
      device: readbackDevice(events, {}),
      queue: { submit: (buffers) => events.push(`submit:${buffers.length}`) },
      commands: [drawCommand()],
      label: "invalid-viewport",
      viewport: { x: 0, y: 0, width: 0, height: 128 },
    });

    expect(report.valid).toBe(false);
    expect(report.rectangle).toMatchObject({
      valid: false,
      diagnostics: [
        {
          code: "frameBoundaryPassRectangle.invalidRectangle",
          message: expect.stringContaining("0,0,0,128"),
        },
      ],
    });
    expect(report.execution).toBeNull();
    expect(events).toEqual(["begin", "end", "finish", "submit:1"]);
  });

  it("rejects scissor rectangles without finite positive dimensions", () => {
    const report = assembleFrameBoundary({
      context: contextWithView({ label: "view" }),
      device: readbackDevice([], {}),
      queue: { submit: () => {} },
      commands: [drawCommand()],
      label: "invalid-scissor",
      scissor: { x: 0, y: 0, width: 64, height: Number.NaN },
    });

    expect(report.valid).toBe(false);
    expect(report.rectangle).toMatchObject({
      valid: false,
      diagnostics: [
        {
          code: "frameBoundaryPassRectangle.invalidRectangle",
          message: expect.stringContaining("0,0,64,NaN"),
        },
      ],
    });
  });

  it("diagnoses render passes that cannot apply viewport or scissor rectangles", () => {
    const report = assembleFrameBoundary({
      context: contextWithView({ label: "view" }),
      device: readbackDevice([], { omitPassRectangles: true }),
      queue: { submit: () => {} },
      commands: [drawCommand()],
      label: "missing-rectangle-methods",
      viewport: { x: 0, y: 0, width: 64, height: 32 },
      scissor: { x: 0, y: 0, width: 64, height: 32 },
    });

    expect(report.valid).toBe(false);
    expect(report.rectangle).toMatchObject({
      valid: false,
      diagnostics: [
        { code: "frameBoundaryPassRectangle.missingSetViewport" },
        { code: "frameBoundaryPassRectangle.missingSetScissorRect" },
      ],
    });
  });
});

function stubReadbackGlobals(): void {
  vi.stubGlobal("GPUBufferUsage", { MAP_READ: 1, COPY_DST: 8 });
  vi.stubGlobal("GPUMapMode", { READ: 1 });
}

function contextWithView(view: unknown) {
  return {
    getCurrentTexture: () => ({
      createView: () => view,
    }),
  };
}

function assembleReadbackBoundary(overrides: {
  readonly device?: AssembleFrameBoundaryOptions["device"];
  readonly readback?: AssembleFrameBoundaryOptions["readback"];
}) {
  return assembleFrameBoundary({
    context: contextWithView({ label: "view" }),
    device:
      overrides.device ??
      readbackDevice([], {
        createBuffer: () => ({}),
        copyTextureToBuffer: () => {},
      }),
    queue: { submit: () => {} },
    commands: [drawCommand()],
    label: "readback-frame",
    readback: overrides.readback ?? {
      format: "bgra8unorm",
      width: 8,
      height: 4,
      samples: [{ id: "center", x: 0.5, y: 0.5 }],
    },
  });
}

function readbackDeviceWithBuffer(buffer: FrameBoundaryReadbackBufferLike) {
  return readbackDevice([], {
    createBuffer: () => buffer,
    copyTextureToBuffer: () => {},
  });
}

function readbackDevice(
  events: string[],
  options: {
    readonly createBuffer?: (
      descriptor: unknown,
    ) => FrameBoundaryReadbackBufferLike;
    readonly copyTextureToBuffer?: (
      source: unknown,
      destination: unknown,
      copySize: unknown,
    ) => void;
    readonly omitPassRectangles?: boolean;
  },
) {
  return {
    ...(options.createBuffer === undefined
      ? {}
      : { createBuffer: options.createBuffer }),
    createCommandEncoder: () => ({
      beginRenderPass: () => {
        events.push("begin");
        return {
          ...(options.omitPassRectangles === true
            ? {}
            : {
                setViewport: () => events.push("viewport"),
                setScissorRect: () => events.push("scissor"),
              }),
          draw: () => events.push("draw"),
          end: () => events.push("end"),
        };
      },
      ...(options.copyTextureToBuffer === undefined
        ? {}
        : { copyTextureToBuffer: options.copyTextureToBuffer }),
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
