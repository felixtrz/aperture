import type {
  WebGpuClearColor,
  WebGpuClearContextLike,
  WebGpuClearFailure,
  WebGpuClearFailureReason,
  WebGpuClearResult,
  WebGpuCommandEncoderLike,
  WebGpuTextureLike,
} from "./clear.js";
import { finishCommandEncoder } from "./command-buffer.js";
import { createCommandEncoderResource } from "./command-encoder.js";
import { submitCommandBuffers } from "./queue-submit.js";
import {
  createRenderPassAttachmentPlan,
  type RenderPassAttachmentDescriptorPlan,
} from "./render-pass-attachments.js";
import {
  beginPlannedRenderPass,
  endPlannedRenderPass,
  type RenderPassCommandEncoderLike,
  type RenderPassEncoderWithEndLike,
} from "./render-pass-lifecycle.js";

const readbackBytesPerRow = 256;

export type WebGpuClearReadbackFailureReason =
  | WebGpuClearFailureReason
  | "texture-usage-unavailable"
  | "texture-size-invalid"
  | "unsupported-texture-format"
  | "buffer-usage-unavailable"
  | "map-mode-unavailable"
  | "create-buffer-unavailable"
  | "copy-texture-to-buffer-unavailable"
  | "map-read-unavailable"
  | "mapped-range-unavailable"
  | "readback-map-failed";

export interface WebGpuReadbackCanvasTextureUsageSuccess {
  readonly ok: true;
  readonly usage: number;
  readonly copySrc: number;
  readonly renderAttachment: number;
}

export interface WebGpuReadbackCanvasTextureUsageFailure {
  readonly ok: false;
  readonly reason: "texture-usage-unavailable";
  readonly message: string;
}

export type WebGpuReadbackCanvasTextureUsageResult =
  | WebGpuReadbackCanvasTextureUsageSuccess
  | WebGpuReadbackCanvasTextureUsageFailure;

export interface WebGpuTextureUsageEnvironment {
  readonly GPUTextureUsage?: {
    readonly COPY_SRC?: number;
    readonly RENDER_ATTACHMENT?: number;
  };
}

export interface WebGpuBufferUsageEnvironment {
  readonly GPUBufferUsage?: {
    readonly MAP_READ?: number;
    readonly COPY_DST?: number;
  };
  readonly GPUMapMode?: {
    readonly READ?: number;
  };
}

export interface WebGpuReadbackBufferUsage {
  readonly mapRead: number;
  readonly copyDst: number;
}

export interface WebGpuReadbackPixel {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

export interface WebGpuReadbackOrigin {
  readonly x: number;
  readonly y: number;
}

export interface WebGpuClearReadbackSuccess {
  readonly ok: true;
  readonly source: "current-texture";
  readonly format: string;
  readonly origin: WebGpuReadbackOrigin;
  readonly bytesPerRow: number;
  readonly pixel: WebGpuReadbackPixel;
}

export interface WebGpuClearReadbackFailure {
  readonly ok: false;
  readonly reason: WebGpuClearReadbackFailureReason;
  readonly message: string;
  readonly clearOk: boolean;
}

export type WebGpuClearReadbackResult =
  | WebGpuClearReadbackSuccess
  | WebGpuClearReadbackFailure;

export interface ClearWebGpuCanvasWithReadbackResult {
  readonly clear: WebGpuClearResult;
  readonly readback: WebGpuClearReadbackResult;
}

export interface WebGpuClearReadbackBufferLike {
  mapAsync?: (mode: number) => Promise<void>;
  getMappedRange?: () => ArrayBuffer | ArrayBufferView;
  unmap?: () => void;
}

export interface WebGpuClearReadbackDeviceLike {
  readonly queue?: {
    submit(commandBuffers: readonly unknown[]): void;
  };
  createCommandEncoder?: () => WebGpuReadbackCommandEncoderLike;
  createBuffer?: (descriptor: unknown) => WebGpuClearReadbackBufferLike;
}

export interface WebGpuReadbackCommandEncoderLike extends WebGpuCommandEncoderLike {
  copyTextureToBuffer?: (
    source: unknown,
    destination: unknown,
    copySize: unknown,
  ) => void;
}

export interface ClearWebGpuCanvasWithReadbackOptions {
  readonly device: WebGpuClearReadbackDeviceLike;
  readonly context: WebGpuClearContextLike;
  readonly format: string;
  readonly width: number;
  readonly height: number;
  readonly color?: WebGpuClearColor;
  readonly depth?: number;
  readonly stencil?: number;
  readonly origin?: WebGpuReadbackOrigin;
  readonly bufferUsage?: WebGpuReadbackBufferUsage;
  readonly mapModeRead?: number;
  readonly environment?: WebGpuBufferUsageEnvironment;
}

interface ReadbackCopyPlan {
  readonly ok: true;
  readonly buffer: WebGpuClearReadbackBufferLike;
  readonly mapModeRead: number;
  readonly textureFormat: string;
  readonly byteOrder: TextureByteOrder;
  readonly origin: WebGpuReadbackOrigin;
  readonly bytesPerRow: number;
}

type TextureByteOrder = "rgba" | "bgra";

export function createReadbackCanvasTextureUsage(
  environment: WebGpuTextureUsageEnvironment = globalThis as WebGpuTextureUsageEnvironment,
): WebGpuReadbackCanvasTextureUsageResult {
  const copySrc = environment.GPUTextureUsage?.COPY_SRC;
  const renderAttachment = environment.GPUTextureUsage?.RENDER_ATTACHMENT;

  if (typeof copySrc !== "number" || typeof renderAttachment !== "number") {
    return {
      ok: false,
      reason: "texture-usage-unavailable",
      message:
        "WebGPU texture usage flags are unavailable; current-texture readback cannot opt the canvas into COPY_SRC usage.",
    };
  }

  return {
    ok: true,
    usage: copySrc | renderAttachment,
    copySrc,
    renderAttachment,
  };
}

export async function clearWebGpuCanvasWithReadback(
  options: ClearWebGpuCanvasWithReadbackOptions,
): Promise<ClearWebGpuCanvasWithReadbackResult> {
  if (options.device.queue === undefined) {
    const clear = clearFailure(
      "queue-unavailable",
      "WebGPU device queue is unavailable.",
    );

    return { clear, readback: fromClearFailure(clear) };
  }

  if (options.device.createCommandEncoder === undefined) {
    const clear = clearFailure(
      "encoder-unavailable",
      "WebGPU device cannot create a command encoder.",
    );

    return { clear, readback: fromClearFailure(clear) };
  }

  const texture = options.context.getCurrentTexture?.() ?? null;

  if (texture === null) {
    const clear = clearFailure(
      "current-texture-unavailable",
      "WebGPU context did not provide a current texture.",
    );

    return { clear, readback: fromClearFailure(clear) };
  }

  const view = texture.createView?.();

  if (view === undefined) {
    const clear = clearFailure(
      "texture-view-unavailable",
      "WebGPU current texture did not provide a texture view.",
    );

    return { clear, readback: fromClearFailure(clear) };
  }

  const color = options.color ?? { r: 0, g: 0, b: 0, a: 1 };
  const attachmentPlan = createRenderPassAttachmentPlan({
    colorTargets: [
      {
        view,
        clearColor: [color.r, color.g, color.b, color.a],
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  });

  if (!attachmentPlan.valid || attachmentPlan.plan === null) {
    const clear = clearFailure(
      "texture-view-unavailable",
      "WebGPU clear target is invalid.",
    );

    return { clear, readback: fromClearFailure(clear) };
  }

  const encoderResource = createCommandEncoderResource({
    device: options.device,
    label: "clear-readback",
  });

  if (!encoderResource.valid || encoderResource.resource === null) {
    const clear = clearFailure(
      "encoder-unavailable",
      "WebGPU device cannot create a command encoder.",
    );

    return { clear, readback: fromClearFailure(clear) };
  }

  const encoder = encoderResource.resource
    .encoder as RenderPassCommandEncoderLike &
    WebGpuCommandEncoderLike &
    WebGpuReadbackCommandEncoderLike;
  const begin = beginPlannedRenderPass({
    encoder,
    plan: withDepthStencil(attachmentPlan.plan, options),
  });

  if (!begin.valid || begin.pass === null) {
    const clear = clearFailure(
      "encoder-unavailable",
      "WebGPU command encoder cannot begin a render pass.",
    );

    return { clear, readback: fromClearFailure(clear) };
  }

  const end = endPlannedRenderPass(begin.pass as RenderPassEncoderWithEndLike);

  if (!end.valid) {
    const clear = clearFailure(
      "encoder-unavailable",
      "WebGPU render pass encoder cannot end a render pass.",
    );

    return { clear, readback: fromClearFailure(clear) };
  }

  const readbackPlan = createReadbackCopyPlan(options, texture, encoder);

  const finished = finishCommandEncoder({
    encoder,
    label: "clear-readback",
  });

  if (!finished.valid || finished.resource === null) {
    const clear = clearFailure(
      "encoder-unavailable",
      "WebGPU command encoder cannot finish command buffers.",
    );

    return { clear, readback: fromClearFailure(clear) };
  }

  const submitted = submitCommandBuffers({
    queue: options.device.queue,
    commandBuffers: [finished.resource],
  });

  if (!submitted.valid) {
    const clear = clearFailure(
      "queue-unavailable",
      "WebGPU device queue is unavailable.",
    );

    return { clear, readback: fromClearFailure(clear) };
  }

  const clear: WebGpuClearResult = {
    ok: true,
    commandBuffer: finished.resource.commandBuffer,
  };

  if (!readbackPlan.ok) {
    return { clear, readback: { ...readbackPlan, clearOk: true } };
  }

  return {
    clear,
    readback: await mapReadbackBuffer(readbackPlan),
  };
}

function createReadbackCopyPlan(
  options: ClearWebGpuCanvasWithReadbackOptions,
  texture: WebGpuTextureLike,
  encoder: WebGpuReadbackCommandEncoderLike,
): ReadbackCopyPlan | WebGpuClearReadbackFailure {
  const byteOrder = textureByteOrder(options.format);

  if (byteOrder === null) {
    return readbackFailure(
      "unsupported-texture-format",
      `WebGPU readback does not know how to decode '${options.format}' texture bytes.`,
      false,
    );
  }

  const origin = options.origin ?? centerOrigin(options.width, options.height);

  if (!isValidOrigin(origin, options.width, options.height)) {
    return readbackFailure(
      "texture-size-invalid",
      `WebGPU readback origin (${origin.x}, ${origin.y}) is outside the ${options.width}x${options.height} texture.`,
      false,
    );
  }

  const bufferUsage = resolveBufferUsage(options);

  if (!bufferUsage.ok) {
    return bufferUsage;
  }

  const mapModeRead = resolveMapModeRead(options);

  if (!mapModeRead.ok) {
    return mapModeRead;
  }

  if (options.device.createBuffer === undefined) {
    return readbackFailure(
      "create-buffer-unavailable",
      "WebGPU device cannot create a readback buffer.",
      false,
    );
  }

  if (encoder.copyTextureToBuffer === undefined) {
    return readbackFailure(
      "copy-texture-to-buffer-unavailable",
      "WebGPU command encoder cannot copy the current texture into a readback buffer.",
      false,
    );
  }

  let buffer: WebGpuClearReadbackBufferLike;

  try {
    buffer = options.device.createBuffer({
      label: "aperture-clear-readback",
      size: readbackBytesPerRow,
      usage: bufferUsage.value.mapRead | bufferUsage.value.copyDst,
    });
  } catch (cause) {
    return readbackFailure(
      "create-buffer-unavailable",
      `WebGPU readback buffer creation failed: ${messageFromCause(cause)}`,
      false,
    );
  }

  try {
    encoder.copyTextureToBuffer(
      {
        texture,
        origin: { x: origin.x, y: origin.y, z: 0 },
      },
      {
        buffer,
        bytesPerRow: readbackBytesPerRow,
        rowsPerImage: 1,
      },
      { width: 1, height: 1, depthOrArrayLayers: 1 },
    );
  } catch (cause) {
    return readbackFailure(
      "copy-texture-to-buffer-unavailable",
      `WebGPU current-texture copy failed: ${messageFromCause(cause)}`,
      false,
    );
  }

  return {
    ok: true,
    buffer,
    mapModeRead: mapModeRead.value,
    textureFormat: options.format,
    byteOrder,
    origin,
    bytesPerRow: readbackBytesPerRow,
  };
}

async function mapReadbackBuffer(
  plan: ReadbackCopyPlan,
): Promise<WebGpuClearReadbackResult> {
  if (plan.buffer.mapAsync === undefined) {
    return readbackFailure(
      "map-read-unavailable",
      "WebGPU readback buffer cannot be mapped for reading.",
      true,
    );
  }

  if (plan.buffer.getMappedRange === undefined) {
    return readbackFailure(
      "mapped-range-unavailable",
      "WebGPU readback buffer cannot expose a mapped range.",
      true,
    );
  }

  try {
    await plan.buffer.mapAsync(plan.mapModeRead);
  } catch (cause) {
    return readbackFailure(
      "readback-map-failed",
      `WebGPU readback buffer mapping failed: ${messageFromCause(cause)}`,
      true,
    );
  }

  try {
    const bytes = mappedRangeBytes(plan.buffer.getMappedRange());

    return {
      ok: true,
      source: "current-texture",
      format: plan.textureFormat,
      origin: plan.origin,
      bytesPerRow: plan.bytesPerRow,
      pixel: decodeTexturePixel(plan.byteOrder, bytes),
    };
  } catch (cause) {
    return readbackFailure(
      "mapped-range-unavailable",
      `WebGPU readback mapped range could not be read: ${messageFromCause(cause)}`,
      true,
    );
  } finally {
    try {
      plan.buffer.unmap?.();
    } catch {
      // Best effort cleanup; the pixel readback result is more useful than an unmap throw.
    }
  }
}

function resolveBufferUsage(
  options: ClearWebGpuCanvasWithReadbackOptions,
):
  | { readonly ok: true; readonly value: WebGpuReadbackBufferUsage }
  | WebGpuClearReadbackFailure {
  const environment =
    options.environment ?? (globalThis as WebGpuBufferUsageEnvironment);
  const mapRead =
    options.bufferUsage?.mapRead ?? environment.GPUBufferUsage?.MAP_READ;
  const copyDst =
    options.bufferUsage?.copyDst ?? environment.GPUBufferUsage?.COPY_DST;

  if (typeof mapRead !== "number" || typeof copyDst !== "number") {
    return readbackFailure(
      "buffer-usage-unavailable",
      "WebGPU buffer usage flags are unavailable; readback requires MAP_READ and COPY_DST.",
      false,
    );
  }

  return { ok: true, value: { mapRead, copyDst } };
}

function resolveMapModeRead(
  options: ClearWebGpuCanvasWithReadbackOptions,
): { readonly ok: true; readonly value: number } | WebGpuClearReadbackFailure {
  const environment =
    options.environment ?? (globalThis as WebGpuBufferUsageEnvironment);
  const mapModeRead = options.mapModeRead ?? environment.GPUMapMode?.READ;

  if (typeof mapModeRead !== "number") {
    return readbackFailure(
      "map-mode-unavailable",
      "WebGPU map mode flags are unavailable; readback requires GPUMapMode.READ.",
      false,
    );
  }

  return { ok: true, value: mapModeRead };
}

function textureByteOrder(format: string): TextureByteOrder | null {
  switch (format) {
    case "rgba8unorm":
    case "rgba8unorm-srgb":
      return "rgba";
    case "bgra8unorm":
    case "bgra8unorm-srgb":
      return "bgra";
    default:
      return null;
  }
}

function decodeTexturePixel(
  format: TextureByteOrder,
  bytes: Uint8Array,
): WebGpuReadbackPixel {
  if (format === "bgra") {
    return {
      r: bytes[2] ?? 0,
      g: bytes[1] ?? 0,
      b: bytes[0] ?? 0,
      a: bytes[3] ?? 0,
    };
  }

  return {
    r: bytes[0] ?? 0,
    g: bytes[1] ?? 0,
    b: bytes[2] ?? 0,
    a: bytes[3] ?? 0,
  };
}

function mappedRangeBytes(range: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (ArrayBuffer.isView(range)) {
    return new Uint8Array(range.buffer, range.byteOffset, range.byteLength);
  }

  return new Uint8Array(range);
}

function centerOrigin(width: number, height: number): WebGpuReadbackOrigin {
  return {
    x: Math.max(0, Math.floor(width / 2)),
    y: Math.max(0, Math.floor(height / 2)),
  };
}

function isValidOrigin(
  origin: WebGpuReadbackOrigin,
  width: number,
  height: number,
): boolean {
  return (
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width > 0 &&
    height > 0 &&
    Number.isInteger(origin.x) &&
    Number.isInteger(origin.y) &&
    origin.x >= 0 &&
    origin.y >= 0 &&
    origin.x < width &&
    origin.y < height
  );
}

function fromClearFailure(
  clear: WebGpuClearFailure,
): WebGpuClearReadbackFailure {
  return readbackFailure(clear.reason, clear.message, false);
}

function clearFailure(
  reason: WebGpuClearFailureReason,
  message: string,
): WebGpuClearFailure {
  return { ok: false, reason, message };
}

function readbackFailure(
  reason: WebGpuClearReadbackFailureReason,
  message: string,
  clearOk: boolean,
): WebGpuClearReadbackFailure {
  return { ok: false, reason, message, clearOk };
}

function messageFromCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function withDepthStencil(
  plan: RenderPassAttachmentDescriptorPlan,
  options: ClearWebGpuCanvasWithReadbackOptions,
): RenderPassAttachmentDescriptorPlan {
  if (options.depth === undefined && options.stencil === undefined) {
    return plan;
  }

  return {
    ...plan,
    depthStencilAttachment: {
      view: plan.colorAttachments[0]?.view,
      depthClearValue: options.depth,
      depthLoadOp: options.depth === undefined ? "load" : "clear",
      depthStoreOp: options.depth === undefined ? "store" : "store",
      stencilClearValue: options.stencil,
      stencilLoadOp: options.stencil === undefined ? undefined : "clear",
      stencilStoreOp: options.stencil === undefined ? undefined : "store",
    } as NonNullable<
      RenderPassAttachmentDescriptorPlan["depthStencilAttachment"]
    >,
  };
}
