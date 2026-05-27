import type { CommandBufferResource } from "../../gpu/command-buffer.js";
import {
  finishCommandEncoder,
  type CommandEncoderFinishLike,
  type FinishCommandEncoderResult,
} from "../../gpu/command-buffer.js";
import {
  createCommandEncoderResource,
  type CommandEncoderDeviceLike,
  type CreateCommandEncoderResult,
} from "../../gpu/command-encoder.js";
import {
  createCurrentTextureColorTarget,
  createOffscreenColorTarget,
  type CreateCurrentTextureColorTargetResult,
  type CurrentTextureContextLike,
  type CurrentTextureLike,
} from "../../app/presentation/current-texture-view.js";
import { submitCommandBuffers, type QueueSubmitLike } from "../queues/queue-submit.js";
import type { SubmitCommandBuffersReport } from "../queues/queue-submit.js";
import {
  createRenderPassAttachmentPlan,
  type CreateRenderPassAttachmentPlanResult,
  type RenderPassAttachmentLoadOp,
  type RenderPassAttachmentStoreOp,
  type RenderPassColorAttachmentInput,
  type RenderPassDepthAttachmentInput,
} from "../passes/render-pass-attachments.js";
import {
  executeRenderPassCommands,
  type RenderPassCommandExecutionReport,
  type RenderPassEncoderLike,
} from "../passes/render-pass-command-executor.js";
import type { RenderPassCommand } from "../passes/render-pass-commands.js";
import {
  executeRenderPassCommandsWithRenderBundle,
  type RenderBundleCache,
  type RenderBundleDeviceLike,
  type RenderBundleEncoderDescriptorLike,
  type RenderBundleExecutionReport,
  type RenderBundleRenderPassLike,
} from "../draw/render-bundle.js";
import {
  resolveGpuTimestampQueries,
  writeGpuTimestampQuery,
  type GpuTimestampCommandEncoderLike,
  type GpuTimestampCommandReport,
  type GpuTimestampQueryResources,
} from "../../gpu/gpu-timing.js";
import {
  resolveGpuOcclusionQueries,
  type GpuOcclusionCommandEncoderLike,
  type GpuOcclusionQueryResources,
  type GpuOcclusionQueryResolveReport,
} from "../../gpu/occlusion-query.js";
import {
  beginPlannedRenderPass,
  endPlannedRenderPass,
  type BeginRenderPassResult,
  type EndRenderPassResult,
  type RenderPassCommandEncoderLike,
  type RenderPassEncoderWithEndLike,
} from "../passes/render-pass-lifecycle.js";

export interface FrameBoundaryDeviceLike
  extends CommandEncoderDeviceLike, RenderBundleDeviceLike {
  createCommandEncoder?: () => RenderPassCommandEncoderLike &
    CommandEncoderFinishLike &
    FrameBoundaryReadbackCommandEncoderLike;
  createBuffer?: (descriptor: unknown) => FrameBoundaryReadbackBufferLike;
}

export interface FrameBoundaryReadbackSampleRequest {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

export interface FrameBoundaryReadbackOptions {
  readonly format: string;
  readonly width: number;
  readonly height: number;
  readonly samples: readonly FrameBoundaryReadbackSampleRequest[];
}

export type FrameBoundaryReadbackFailureReason =
  | "unsupported-texture-format"
  | "texture-size-invalid"
  | "buffer-usage-unavailable"
  | "map-mode-unavailable"
  | "create-buffer-unavailable"
  | "copy-texture-to-buffer-unavailable"
  | "map-read-unavailable"
  | "mapped-range-unavailable"
  | "readback-map-failed";

export interface FrameBoundaryReadbackPixel {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

export interface FrameBoundaryReadbackOrigin {
  readonly x: number;
  readonly y: number;
}

export interface FrameBoundaryReadbackSample {
  readonly id: string;
  readonly origin: FrameBoundaryReadbackOrigin;
  readonly pixel: FrameBoundaryReadbackPixel;
}

export interface FrameBoundaryReadbackSuccess {
  readonly ok: true;
  readonly source: FrameBoundaryColorTargetSource;
  readonly format: string;
  readonly bytesPerRow: number;
  readonly samples: readonly FrameBoundaryReadbackSample[];
}

export interface FrameBoundaryReadbackFailure {
  readonly ok: false;
  readonly reason: FrameBoundaryReadbackFailureReason;
  readonly message: string;
  readonly clearOk: boolean;
}

export type FrameBoundaryReadbackResult =
  | FrameBoundaryReadbackSuccess
  | FrameBoundaryReadbackFailure;

export interface FrameBoundaryReadbackBufferLike {
  mapAsync?: (mode: number) => Promise<void>;
  getMappedRange?: () => ArrayBuffer | ArrayBufferView;
  unmap?: () => void;
}

export interface FrameBoundaryReadbackCommandEncoderLike {
  copyTextureToBuffer?: (
    source: unknown,
    destination: unknown,
    copySize: unknown,
  ) => void;
}

interface FrameBoundaryReadbackCopyPlan {
  readonly ok: true;
  readonly source: FrameBoundaryColorTargetSource;
  readonly format: string;
  readonly byteOrder: TextureByteOrder;
  readonly bytesPerRow: number;
  readonly mapModeRead: number;
  readonly samples: readonly {
    readonly id: string;
    readonly origin: FrameBoundaryReadbackOrigin;
    readonly buffer: FrameBoundaryReadbackBufferLike;
  }[];
}

type FrameBoundaryReadbackPlan =
  | FrameBoundaryReadbackCopyPlan
  | FrameBoundaryReadbackFailure;

export type FrameBoundaryColorTargetSource =
  | "current-texture"
  | "offscreen-target";

export interface FrameBoundaryCurrentTextureTarget {
  readonly source: "current-texture";
}

export interface FrameBoundaryOffscreenTarget {
  readonly source: "offscreen-target";
  readonly texture: CurrentTextureLike | null | undefined;
}

export type FrameBoundaryColorTarget =
  | FrameBoundaryCurrentTextureTarget
  | FrameBoundaryOffscreenTarget;

export interface FrameBoundaryMsaaColorTarget {
  readonly view: unknown;
  readonly sampleCount: number;
}

export interface FrameBoundaryViewRectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type FrameBoundaryPassRectangleDiagnosticCode =
  | "frameBoundaryPassRectangle.invalidRectangle"
  | "frameBoundaryPassRectangle.missingSetViewport"
  | "frameBoundaryPassRectangle.missingSetScissorRect";

export interface FrameBoundaryPassRectangleDiagnostic {
  readonly code: FrameBoundaryPassRectangleDiagnosticCode;
  readonly message: string;
}

export interface FrameBoundaryPassRectangleReport {
  readonly valid: boolean;
  readonly viewport: FrameBoundaryViewRectangle | null;
  readonly scissor: FrameBoundaryViewRectangle | null;
  readonly diagnostics: readonly FrameBoundaryPassRectangleDiagnostic[];
}

type TextureByteOrder = "rgba" | "bgra";

const readbackBytesPerRow = 256;

export interface AssembleFrameBoundaryOptions {
  readonly context: CurrentTextureContextLike;
  readonly device: FrameBoundaryDeviceLike;
  readonly queue: QueueSubmitLike;
  readonly commands: readonly RenderPassCommand[];
  readonly label: string;
  readonly colorTarget?: FrameBoundaryColorTarget;
  readonly additionalColorTargets?: readonly RenderPassColorAttachmentInput[];
  readonly msaaColorTarget?: FrameBoundaryMsaaColorTarget | null;
  readonly colorLoadOp?: RenderPassAttachmentLoadOp;
  readonly msaaColorStoreOp?: RenderPassAttachmentStoreOp;
  readonly viewport?: FrameBoundaryViewRectangle | null;
  readonly scissor?: FrameBoundaryViewRectangle | null;
  readonly clearColor?: readonly number[];
  readonly depthTarget?: RenderPassDepthAttachmentInput | null;
  readonly readback?: FrameBoundaryReadbackOptions;
  readonly gpuTiming?: FrameBoundaryGpuTimingOptions;
  readonly occlusionQueries?: FrameBoundaryOcclusionQueryOptions;
  readonly renderBundle?: FrameBoundaryRenderBundleOptions;
}

export interface FrameBoundaryRenderBundleOptions {
  readonly cache: RenderBundleCache;
  readonly key: string;
  readonly descriptor: RenderBundleEncoderDescriptorLike;
  readonly enabled?: boolean;
}

export interface FrameBoundaryGpuTimingOptions {
  readonly passName: string;
  readonly resources: GpuTimestampQueryResources;
  readonly startQuery?: number;
  readonly endQuery?: number;
  readonly resolveQueryCount?: number;
}

export interface FrameBoundaryOcclusionQueryOptions {
  readonly resources: GpuOcclusionQueryResources;
  readonly queryCount: number;
}

export interface FrameBoundaryGpuTimingCommandReport {
  readonly pass: string;
  readonly startQuery: number;
  readonly endQuery: number;
  readonly writeStart: GpuTimestampCommandReport | null;
  readonly writeEnd: GpuTimestampCommandReport | null;
  readonly resolve: GpuTimestampCommandReport | null;
  readonly diagnostics: readonly GpuTimestampCommandReport["diagnostics"][number][];
}

export interface FrameBoundaryAssemblyReport {
  readonly valid: boolean;
  readonly texture: CreateCurrentTextureColorTargetResult;
  readonly attachments: CreateRenderPassAttachmentPlanResult | null;
  readonly encoder: CreateCommandEncoderResult | null;
  readonly begin: BeginRenderPassResult | null;
  readonly rectangle?: FrameBoundaryPassRectangleReport | null;
  readonly execution: RenderPassCommandExecutionReport | null;
  readonly renderBundle?: RenderBundleExecutionReport | null;
  readonly end: EndRenderPassResult | null;
  readonly finish: FinishCommandEncoderResult | null;
  readonly submit: SubmitCommandBuffersReport | null;
  readonly readback?: FrameBoundaryReadbackPlan | null;
  readonly gpuTiming?: FrameBoundaryGpuTimingCommandReport | null;
  readonly occlusionQueries?: GpuOcclusionQueryResolveReport | null;
}

export function assembleFrameBoundary(
  options: AssembleFrameBoundaryOptions,
): FrameBoundaryAssemblyReport {
  const colorTarget = options.colorTarget ?? { source: "current-texture" };
  const texture =
    colorTarget.source === "offscreen-target"
      ? createOffscreenColorTarget({
          texture: colorTarget.texture,
          loadOp: options.colorLoadOp ?? "clear",
          ...(options.clearColor === undefined
            ? {}
            : { clearColor: options.clearColor }),
        })
      : createCurrentTextureColorTarget({
          context: options.context,
          loadOp: options.colorLoadOp ?? "clear",
          ...(options.clearColor === undefined
            ? {}
            : { clearColor: options.clearColor }),
        });
  const attachments =
    texture.target === null
      ? null
      : createRenderPassAttachmentPlan({
          colorTargets: [
            options.msaaColorTarget === undefined ||
            options.msaaColorTarget === null ||
            options.msaaColorTarget.sampleCount <= 1
              ? texture.target
              : {
                  ...texture.target,
                  view: options.msaaColorTarget.view,
                  resolveTarget: texture.target.view,
                  storeOp: options.msaaColorStoreOp ?? "discard",
                },
            ...(options.additionalColorTargets ?? []),
          ],
          ...(options.depthTarget === undefined
            ? {}
            : { depthTarget: options.depthTarget }),
          ...(options.occlusionQueries === undefined
            ? {}
            : {
                occlusionQuerySet: options.occlusionQueries.resources.querySet,
              }),
        });
  const encoder =
    attachments?.valid === true
      ? createCommandEncoderResource({
          device: options.device,
          label: options.label,
        })
      : null;
  const encoderHandle = encoder?.resource?.encoder as
    | (RenderPassCommandEncoderLike &
        CommandEncoderFinishLike &
        FrameBoundaryReadbackCommandEncoderLike &
        GpuTimestampCommandEncoderLike &
        GpuOcclusionCommandEncoderLike)
    | undefined;
  const gpuTimingStart = writeFrameBoundaryGpuTimingStart(
    encoderHandle,
    options.gpuTiming,
  );
  const begin =
    attachments?.plan === undefined || encoderHandle === undefined
      ? null
      : beginPlannedRenderPass({
          encoder: encoderHandle,
          plan: attachments.plan,
        });
  const pass = begin?.pass ?? null;
  const rectangle =
    pass === null
      ? null
      : applyFrameBoundaryPassRectangles({
          pass: pass as FrameBoundaryPassRectangleLike,
          viewport: options.viewport ?? null,
          scissor: options.scissor ?? null,
        });
  const commandExecution =
    pass === null || rectangle?.valid === false
      ? null
      : executeFrameBoundaryCommands({
          pass,
          device: options.device,
          commands: options.commands,
          label: options.label,
          ...(options.renderBundle === undefined
            ? {}
            : { renderBundle: options.renderBundle }),
        });
  const execution = commandExecution?.execution ?? null;
  const renderBundle = commandExecution?.renderBundle ?? null;
  const end =
    pass === null
      ? null
      : endPlannedRenderPass(pass as RenderPassEncoderWithEndLike);
  const gpuTimingEnd = writeFrameBoundaryGpuTimingEnd(
    encoderHandle,
    options.gpuTiming,
  );
  const occlusionQueries = resolveFrameBoundaryOcclusionQueries(
    encoderHandle,
    options.occlusionQueries,
  );
  const gpuTimingResolve = resolveFrameBoundaryGpuTiming(
    encoderHandle,
    options.gpuTiming,
  );
  const readback =
    options.readback === undefined
      ? null
      : createFrameBoundaryReadbackCopyPlan({
          device: options.device,
          encoder: encoderHandle,
          source: colorTarget.source,
          texture: texture.texture,
          readback: options.readback,
        });
  const finish =
    encoderHandle === undefined || end?.valid !== true
      ? null
      : finishCommandEncoder({
          encoder: encoderHandle,
          label: options.label,
        });
  const submit =
    finish?.resource === undefined || finish.resource === null
      ? null
      : submitCommandBuffers({
          queue: options.queue,
          commandBuffers: [finish.resource as CommandBufferResource],
        });

  return {
    valid:
      texture.valid &&
      attachments?.valid === true &&
      encoder?.valid === true &&
      begin?.valid === true &&
      (rectangle === null || rectangle.valid) &&
      execution?.valid === true &&
      end?.valid === true &&
      (occlusionQueries === null || occlusionQueries.valid) &&
      finish?.valid === true &&
      submit?.valid === true,
    texture,
    attachments,
    encoder,
    begin,
    rectangle,
    execution,
    renderBundle,
    end,
    finish,
    submit,
    readback,
    gpuTiming:
      options.gpuTiming === undefined
        ? null
        : createFrameBoundaryGpuTimingCommandReport(
            options.gpuTiming,
            gpuTimingStart,
            gpuTimingEnd,
            gpuTimingResolve,
          ),
    occlusionQueries,
  };
}

function resolveFrameBoundaryOcclusionQueries(
  encoder:
    | (RenderPassCommandEncoderLike &
        CommandEncoderFinishLike &
        FrameBoundaryReadbackCommandEncoderLike &
        GpuTimestampCommandEncoderLike &
        GpuOcclusionCommandEncoderLike)
    | undefined,
  options: FrameBoundaryOcclusionQueryOptions | undefined,
): GpuOcclusionQueryResolveReport | null {
  if (options === undefined) {
    return null;
  }

  if (encoder === undefined) {
    return {
      valid: false,
      diagnostics: [
        {
          code: "gpuOcclusion.commandEncodingUnsupported",
          severity: "error",
          message:
            "GPU occlusion query resolve requires a command encoder resource.",
        },
      ],
    };
  }

  return resolveGpuOcclusionQueries(
    encoder,
    options.resources,
    options.queryCount,
  );
}

function executeFrameBoundaryCommands(options: {
  readonly pass: unknown;
  readonly device: FrameBoundaryDeviceLike;
  readonly commands: readonly RenderPassCommand[];
  readonly label: string;
  readonly renderBundle?: FrameBoundaryRenderBundleOptions;
}): {
  readonly execution: RenderPassCommandExecutionReport;
  readonly renderBundle: RenderBundleExecutionReport | null;
} {
  if (options.renderBundle === undefined) {
    return {
      execution: executeRenderPassCommands({
        pass: options.pass as RenderPassEncoderLike,
        commands: options.commands,
      }),
      renderBundle: null,
    };
  }

  return executeRenderPassCommandsWithRenderBundle({
    pass: options.pass as RenderBundleRenderPassLike,
    device: options.device,
    commands: options.commands,
    cache: options.renderBundle.cache,
    key: options.renderBundle.key,
    descriptor: options.renderBundle.descriptor,
    label: options.label,
    ...(options.renderBundle.enabled === undefined
      ? {}
      : { enabled: options.renderBundle.enabled }),
  });
}

interface FrameBoundaryPassRectangleLike {
  setViewport?: (
    x: number,
    y: number,
    width: number,
    height: number,
    minDepth: number,
    maxDepth: number,
  ) => void;
  setScissorRect?: (
    x: number,
    y: number,
    width: number,
    height: number,
  ) => void;
}

function applyFrameBoundaryPassRectangles(options: {
  readonly pass: FrameBoundaryPassRectangleLike;
  readonly viewport: FrameBoundaryViewRectangle | null;
  readonly scissor: FrameBoundaryViewRectangle | null;
}): FrameBoundaryPassRectangleReport | null {
  if (options.viewport === null && options.scissor === null) {
    return null;
  }

  const diagnostics: FrameBoundaryPassRectangleDiagnostic[] = [];

  if (options.viewport !== null) {
    if (!validFrameBoundaryViewRectangle(options.viewport)) {
      diagnostics.push({
        code: "frameBoundaryPassRectangle.invalidRectangle",
        message: `Render pass viewport must have finite positive dimensions; received ${viewRectangleLabel(
          options.viewport,
        )}.`,
      });
    } else if (options.pass.setViewport === undefined) {
      diagnostics.push({
        code: "frameBoundaryPassRectangle.missingSetViewport",
        message:
          "Render pass encoder cannot apply a viewport rectangle for this view.",
      });
    } else {
      options.pass.setViewport(
        options.viewport.x,
        options.viewport.y,
        options.viewport.width,
        options.viewport.height,
        0,
        1,
      );
    }
  }

  if (options.scissor !== null) {
    if (!validFrameBoundaryViewRectangle(options.scissor)) {
      diagnostics.push({
        code: "frameBoundaryPassRectangle.invalidRectangle",
        message: `Render pass scissor must have finite positive dimensions; received ${viewRectangleLabel(
          options.scissor,
        )}.`,
      });
    } else if (options.pass.setScissorRect === undefined) {
      diagnostics.push({
        code: "frameBoundaryPassRectangle.missingSetScissorRect",
        message:
          "Render pass encoder cannot apply a scissor rectangle for this view.",
      });
    } else {
      options.pass.setScissorRect(
        Math.round(options.scissor.x),
        Math.round(options.scissor.y),
        Math.round(options.scissor.width),
        Math.round(options.scissor.height),
      );
    }
  }

  return {
    valid: diagnostics.length === 0,
    viewport: options.viewport,
    scissor: options.scissor,
    diagnostics,
  };
}

function validFrameBoundaryViewRectangle(
  rect: FrameBoundaryViewRectangle,
): boolean {
  return (
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function viewRectangleLabel(rect: FrameBoundaryViewRectangle): string {
  return `${rect.x},${rect.y},${rect.width},${rect.height}`;
}

function writeFrameBoundaryGpuTimingStart(
  encoder:
    | (RenderPassCommandEncoderLike &
        CommandEncoderFinishLike &
        FrameBoundaryReadbackCommandEncoderLike &
        GpuTimestampCommandEncoderLike)
    | undefined,
  options: FrameBoundaryGpuTimingOptions | undefined,
): GpuTimestampCommandReport | null {
  if (options === undefined || encoder === undefined) {
    return null;
  }

  return writeGpuTimestampQuery(
    encoder,
    options.resources,
    options.startQuery ?? 0,
  );
}

function writeFrameBoundaryGpuTimingEnd(
  encoder:
    | (RenderPassCommandEncoderLike &
        CommandEncoderFinishLike &
        FrameBoundaryReadbackCommandEncoderLike &
        GpuTimestampCommandEncoderLike)
    | undefined,
  options: FrameBoundaryGpuTimingOptions | undefined,
): GpuTimestampCommandReport | null {
  if (options === undefined || encoder === undefined) {
    return null;
  }

  return writeGpuTimestampQuery(
    encoder,
    options.resources,
    options.endQuery ?? (options.startQuery ?? 0) + 1,
  );
}

function resolveFrameBoundaryGpuTiming(
  encoder:
    | (RenderPassCommandEncoderLike &
        CommandEncoderFinishLike &
        FrameBoundaryReadbackCommandEncoderLike &
        GpuTimestampCommandEncoderLike)
    | undefined,
  options: FrameBoundaryGpuTimingOptions | undefined,
): GpuTimestampCommandReport | null {
  if (options === undefined || encoder === undefined) {
    return null;
  }

  return resolveGpuTimestampQueries(
    encoder,
    options.resources,
    options.resolveQueryCount ?? options.resources.queryCount,
  );
}

function createFrameBoundaryGpuTimingCommandReport(
  options: FrameBoundaryGpuTimingOptions,
  writeStart: GpuTimestampCommandReport | null,
  writeEnd: GpuTimestampCommandReport | null,
  resolve: GpuTimestampCommandReport | null,
): FrameBoundaryGpuTimingCommandReport {
  return {
    pass: options.passName,
    startQuery: options.startQuery ?? 0,
    endQuery: options.endQuery ?? (options.startQuery ?? 0) + 1,
    writeStart,
    writeEnd,
    resolve,
    diagnostics: [
      ...(writeStart?.diagnostics ?? []),
      ...(writeEnd?.diagnostics ?? []),
      ...(resolve?.diagnostics ?? []),
    ],
  };
}

export async function mapFrameBoundaryReadbackSamples(
  plan: FrameBoundaryReadbackPlan | null | undefined,
  frameOk: boolean,
): Promise<FrameBoundaryReadbackResult | undefined> {
  if (plan === null || plan === undefined) {
    return undefined;
  }

  if (!plan.ok) {
    return { ...plan, clearOk: frameOk };
  }

  const samples: FrameBoundaryReadbackSample[] = [];

  for (const sample of plan.samples) {
    const buffer = sample.buffer;

    if (buffer.mapAsync === undefined) {
      return readbackFailure(
        "map-read-unavailable",
        `WebGPU readback buffer for '${sample.id}' cannot be mapped for reading.`,
        frameOk,
      );
    }

    if (buffer.getMappedRange === undefined) {
      return readbackFailure(
        "mapped-range-unavailable",
        `WebGPU readback buffer for '${sample.id}' cannot expose a mapped range.`,
        frameOk,
      );
    }

    try {
      await buffer.mapAsync(plan.mapModeRead);
    } catch (cause) {
      return readbackFailure(
        "readback-map-failed",
        `WebGPU readback buffer mapping failed for '${sample.id}': ${messageFromCause(
          cause,
        )}`,
        frameOk,
      );
    }

    try {
      samples.push({
        id: sample.id,
        origin: sample.origin,
        pixel: decodeTexturePixel(
          plan.byteOrder,
          mappedRangeBytes(buffer.getMappedRange()),
        ),
      });
    } catch (cause) {
      return readbackFailure(
        "mapped-range-unavailable",
        `WebGPU readback mapped range could not be read for '${sample.id}': ${messageFromCause(
          cause,
        )}`,
        frameOk,
      );
    } finally {
      try {
        buffer.unmap?.();
      } catch {
        // Best effort cleanup; readback diagnostics are more useful than unmap failures.
      }
    }
  }

  return {
    ok: true,
    source: plan.source,
    format: plan.format,
    bytesPerRow: plan.bytesPerRow,
    samples,
  };
}

function createFrameBoundaryReadbackCopyPlan(options: {
  readonly device: FrameBoundaryDeviceLike;
  readonly encoder:
    | (RenderPassCommandEncoderLike &
        CommandEncoderFinishLike &
        FrameBoundaryReadbackCommandEncoderLike)
    | undefined;
  readonly source: FrameBoundaryColorTargetSource;
  readonly texture: unknown;
  readonly readback: FrameBoundaryReadbackOptions;
}): FrameBoundaryReadbackPlan {
  const byteOrder = textureByteOrder(options.readback.format);

  if (byteOrder === null) {
    return readbackFailure(
      "unsupported-texture-format",
      `WebGPU readback does not know how to decode '${options.readback.format}' texture bytes.`,
      false,
    );
  }

  const usage = resolveBufferUsage();

  if (!usage.ok) {
    return usage;
  }

  const mapMode = resolveMapModeRead();

  if (!mapMode.ok) {
    return mapMode;
  }

  if (options.device.createBuffer === undefined) {
    return readbackFailure(
      "create-buffer-unavailable",
      "WebGPU device cannot create readback buffers.",
      false,
    );
  }

  if (options.encoder?.copyTextureToBuffer === undefined) {
    return readbackFailure(
      "copy-texture-to-buffer-unavailable",
      `WebGPU command encoder cannot copy the ${readbackSourceLabel(
        options.source,
      )} into readback buffers.`,
      false,
    );
  }

  const samples: FrameBoundaryReadbackCopyPlan["samples"][number][] = [];

  for (const sample of options.readback.samples) {
    const origin = sampleOrigin(
      sample,
      options.readback.width,
      options.readback.height,
    );

    if (origin === null) {
      return readbackFailure(
        "texture-size-invalid",
        `WebGPU readback sample '${sample.id}' is outside the ${options.readback.width}x${options.readback.height} texture.`,
        false,
      );
    }

    let buffer: FrameBoundaryReadbackBufferLike;

    try {
      buffer = options.device.createBuffer({
        label: `aperture-${sample.id}-readback`,
        size: readbackBytesPerRow,
        usage: usage.value,
      });
    } catch (cause) {
      return readbackFailure(
        "create-buffer-unavailable",
        `WebGPU readback buffer creation failed: ${messageFromCause(cause)}`,
        false,
      );
    }

    try {
      options.encoder.copyTextureToBuffer(
        {
          texture: options.texture,
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
        `WebGPU ${readbackSourceLabel(options.source)} copy failed: ${messageFromCause(
          cause,
        )}`,
        false,
      );
    }

    samples.push({ id: sample.id, origin, buffer });
  }

  return {
    ok: true,
    source: options.source,
    format: options.readback.format,
    byteOrder,
    bytesPerRow: readbackBytesPerRow,
    mapModeRead: mapMode.value,
    samples,
  };
}

function resolveBufferUsage():
  | { readonly ok: true; readonly value: number }
  | FrameBoundaryReadbackFailure {
  const environment = globalThis as {
    readonly GPUBufferUsage?: {
      readonly MAP_READ?: number;
      readonly COPY_DST?: number;
    };
  };
  const mapRead = environment.GPUBufferUsage?.MAP_READ;
  const copyDst = environment.GPUBufferUsage?.COPY_DST;

  if (typeof mapRead !== "number" || typeof copyDst !== "number") {
    return readbackFailure(
      "buffer-usage-unavailable",
      "WebGPU buffer usage flags are unavailable; readback requires MAP_READ and COPY_DST.",
      false,
    );
  }

  return { ok: true, value: mapRead | copyDst };
}

function resolveMapModeRead():
  | { readonly ok: true; readonly value: number }
  | FrameBoundaryReadbackFailure {
  const environment = globalThis as {
    readonly GPUMapMode?: { readonly READ?: number };
  };
  const read = environment.GPUMapMode?.READ;

  if (typeof read !== "number") {
    return readbackFailure(
      "map-mode-unavailable",
      "WebGPU map mode flags are unavailable; readback requires GPUMapMode.READ.",
      false,
    );
  }

  return { ok: true, value: read };
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

function readbackSourceLabel(source: FrameBoundaryColorTargetSource): string {
  return source === "offscreen-target"
    ? "off-screen target"
    : "current texture";
}

function sampleOrigin(
  sample: FrameBoundaryReadbackSampleRequest,
  width: number,
  height: number,
): FrameBoundaryReadbackOrigin | null {
  const x = Math.floor(width * sample.x);
  const y = Math.floor(height * sample.y);

  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    x < 0 ||
    y < 0 ||
    x >= width ||
    y >= height
  ) {
    return null;
  }

  return { x, y };
}

function decodeTexturePixel(
  byteOrder: TextureByteOrder,
  bytes: Uint8Array,
): FrameBoundaryReadbackPixel {
  if (byteOrder === "bgra") {
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

function readbackFailure(
  reason: FrameBoundaryReadbackFailureReason,
  message: string,
  clearOk: boolean,
): FrameBoundaryReadbackFailure {
  return { ok: false, reason, message, clearOk };
}

function messageFromCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
