import type {
  BatchCompatibilityKey,
  RenderSnapshot,
} from "@aperture-engine/render";
import {
  createWebGpuIdBufferIdForEntity,
  WEBGPU_ID_BUFFER_EMPTY_ID,
  WEBGPU_ID_BUFFER_FORMAT,
} from "./id-buffer.js";
import {
  createWebGpuBuffer,
  type WebGpuBufferDeviceLike,
} from "../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../resources/meshes/mesh-buffer-descriptors.js";
import { resolveUnlitVertexBufferLayouts } from "../materials/unlit/unlit-pipeline.js";
import { hasUnlitVertexColorFeature } from "../materials/unlit/unlit-pipeline-descriptor.js";
import {
  createWebGpuShaderModule,
  type WebGpuShaderDeviceLike,
} from "../gpu/shader.js";
import {
  createWebGpuDepthStencilDescriptor,
  resolveWebGpuPipelineRenderState,
} from "../materials/core/material-render-state.js";
import type {
  WebGpuRenderPipelineCreateDescriptor,
  WebGpuRenderPipelineDeviceLike,
} from "../gpu/pipeline-cache.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";

export type WebGpuIdBufferPickDiagnosticCode =
  | "idBufferPick.unsupportedBatchKey"
  | "idBufferPick.shaderCreationFailed"
  | "idBufferPick.createRenderPipelineUnavailable"
  | "idBufferPick.pipelineCreationFailed"
  | "idBufferPick.createBufferFailed"
  | "idBufferPick.createBindGroupUnavailable"
  | "idBufferPick.pipelineLayoutUnavailable"
  | "idBufferPick.createBindGroupFailed"
  | "idBufferPick.createTextureUnavailable"
  | "idBufferPick.copyTextureToBufferUnavailable"
  | "idBufferPick.createReadbackBufferUnavailable"
  | "idBufferPick.invalidReadbackOrigin"
  | "idBufferPick.mapReadUnavailable"
  | "idBufferPick.readbackMapFailed"
  | "idBufferPick.mappedRangeUnavailable"
  | "idBufferPick.missingPickPipeline";

export interface WebGpuIdBufferPickDiagnostic {
  readonly code: WebGpuIdBufferPickDiagnosticCode;
  readonly message: string;
  readonly renderId?: number;
  readonly pipelineKey?: string;
}

export interface WebGpuIdBufferPickPipelineResource {
  readonly cacheKey: string;
  readonly shaderModule: unknown;
  readonly pipeline: unknown;
  readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
  readonly layouts: {
    readonly view: unknown;
    readonly worldTransforms: unknown;
    readonly ids: unknown;
  };
}

export interface CreateWebGpuIdBufferPickPipelineResourceResult {
  readonly valid: boolean;
  readonly resource: WebGpuIdBufferPickPipelineResource | null;
  readonly diagnostics: readonly WebGpuIdBufferPickDiagnostic[];
}

export interface WebGpuIdBufferPickIdStorageResource {
  readonly resourceKey: string;
  readonly buffer: unknown;
  readonly ids: Uint32Array;
}

export interface CreateWebGpuIdBufferPickIdStorageResult {
  readonly valid: boolean;
  readonly resource: WebGpuIdBufferPickIdStorageResource | null;
  readonly diagnostics: readonly WebGpuIdBufferPickDiagnostic[];
}

export interface WebGpuIdBufferPickBindGroupResource {
  readonly group: number;
  readonly resourceKey: string;
  readonly bindGroup: unknown;
}

export interface CreateWebGpuIdBufferPickBindGroupResult {
  readonly valid: boolean;
  readonly resource: WebGpuIdBufferPickBindGroupResource | null;
  readonly diagnostics: readonly WebGpuIdBufferPickDiagnostic[];
}

export interface WebGpuIdBufferPickTextureResource {
  readonly texture: unknown;
  readonly width: number;
  readonly height: number;
  readonly format: typeof WEBGPU_ID_BUFFER_FORMAT;
  destroy?(): void;
}

export interface CreateWebGpuIdBufferPickTextureResult {
  readonly valid: boolean;
  readonly resource: WebGpuIdBufferPickTextureResource | null;
  readonly diagnostics: readonly WebGpuIdBufferPickDiagnostic[];
}

export interface WebGpuIdBufferPickReadbackSuccess {
  readonly ok: true;
  readonly id: number;
  readonly origin: { readonly x: number; readonly y: number };
  readonly bytesPerRow: number;
}

export interface WebGpuIdBufferPickReadbackFailure {
  readonly ok: false;
  readonly reason: WebGpuIdBufferPickDiagnosticCode;
  readonly message: string;
  readonly origin?: { readonly x: number; readonly y: number };
}

export type WebGpuIdBufferPickReadbackResult =
  | WebGpuIdBufferPickReadbackSuccess
  | WebGpuIdBufferPickReadbackFailure;

export interface WebGpuIdBufferPickPipelineDeviceLike
  extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {
  createBindGroupLayout?: (descriptor: unknown) => unknown;
  createPipelineLayout?: (descriptor: unknown) => unknown;
  pushErrorScope?: (filter: "validation") => void;
  popErrorScope?: () => Promise<{ readonly message?: string } | null>;
}

export interface WebGpuIdBufferPickBindGroupDeviceLike {
  createBindGroup?: (descriptor: unknown) => unknown;
}

export interface WebGpuIdBufferPickTextureDeviceLike {
  createTexture?: (descriptor: unknown) => {
    createView?: () => unknown;
    destroy?: () => void;
  };
}

export interface WebGpuIdBufferPickReadbackDeviceLike {
  readonly queue?: {
    submit?: (commandBuffers: readonly unknown[]) => void;
  };
  createCommandEncoder?: () => {
    copyTextureToBuffer?: (
      source: unknown,
      destination: unknown,
      copySize: unknown,
    ) => void;
    finish?: () => unknown;
  };
  createBuffer?: (descriptor: unknown) => {
    mapAsync?: (mode: number) => Promise<void>;
    getMappedRange?: () => ArrayBuffer | ArrayBufferView;
    unmap?: () => void;
  };
}

const ID_PICK_SHADER_BASE = `
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @builtin(instance_index) instanceIndex: u32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) @interpolate(flat) pickId: u32,
};

struct FragmentOutput {
  @location(0) id: u32,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(2) @binding(0) var<storage, read> pickIds: array<u32>;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  _ = input.normal;
  _ = input.uv;
  var output: VertexOutput;
  let world = worldTransforms[input.instanceIndex];
  output.position = view.viewProjection * world * vec4f(input.position, 1.0);
  output.pickId = pickIds[input.instanceIndex];
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> FragmentOutput {
  var output: FragmentOutput;
  output.id = input.pickId;
  return output;
}
`.trim();

const ID_PICK_SHADER_VERTEX_COLOR = `
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(5) color: vec4f,
  @builtin(instance_index) instanceIndex: u32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) @interpolate(flat) pickId: u32,
};

struct FragmentOutput {
  @location(0) id: u32,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(2) @binding(0) var<storage, read> pickIds: array<u32>;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  _ = input.normal;
  _ = input.uv;
  _ = input.color;
  var output: VertexOutput;
  let world = worldTransforms[input.instanceIndex];
  output.position = view.viewProjection * world * vec4f(input.position, 1.0);
  output.pickId = pickIds[input.instanceIndex];
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> FragmentOutput {
  var output: FragmentOutput;
  output.id = input.pickId;
  return output;
}
`.trim();

const readbackBytesPerRow = 256;

export async function createWebGpuIdBufferPickPipelineResource(options: {
  readonly device: WebGpuIdBufferPickPipelineDeviceLike;
  readonly batchKey: BatchCompatibilityKey;
  readonly depthFormat?: string | null;
}): Promise<CreateWebGpuIdBufferPickPipelineResourceResult> {
  const unsupported = validatePickBatchKey(options.batchKey);

  if (unsupported !== null) {
    return { valid: false, resource: null, diagnostics: [unsupported] };
  }

  const usesVertexColor = hasUnlitVertexColorFeature(options.batchKey);
  const shaderModule = await createWebGpuShaderModule({
    device: options.device,
    descriptor: {
      label: usesVertexColor
        ? "aperture/id-buffer-pick-vertex-color"
        : "aperture/id-buffer-pick",
      code: usesVertexColor ? ID_PICK_SHADER_VERTEX_COLOR : ID_PICK_SHADER_BASE,
    },
  });

  if (!shaderModule.ok) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "idBufferPick.shaderCreationFailed",
          message: shaderModule.message,
        },
      ],
    };
  }

  if (options.device.createRenderPipeline === undefined) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "idBufferPick.createRenderPipelineUnavailable",
          message: "WebGPU ID-buffer picking requires createRenderPipeline.",
        },
      ],
    };
  }

  const layout = createPickPipelineLayout(options.device);

  if (layout.diagnostics.length > 0) {
    return {
      valid: false,
      resource: null,
      diagnostics: layout.diagnostics,
    };
  }

  const renderState = resolveWebGpuPipelineRenderState(
    options.batchKey.pipelineKey,
    options.depthFormat,
  );
  const descriptor: WebGpuRenderPipelineCreateDescriptor = {
    label: `aperture/id-buffer-pick:${options.batchKey.pipelineKey}`,
    layout: layout.layout,
    vertex: {
      module: shaderModule.module,
      entryPoint: "vs_main",
      buffers: resolveUnlitVertexBufferLayouts(options.batchKey),
    },
    fragment: {
      module: shaderModule.module,
      entryPoint: "fs_main",
      targets: [{ format: WEBGPU_ID_BUFFER_FORMAT }],
    },
    primitive: {
      topology: "triangle-list",
      frontFace: "ccw",
      cullMode: renderState.cullMode,
    },
  };
  const depthStencil = createWebGpuDepthStencilDescriptor(
    options.depthFormat,
    renderState,
  );
  const finalDescriptor =
    depthStencil === null ? descriptor : { ...descriptor, depthStencil };

  try {
    pushPickPipelineErrorScope(options.device);
    const pipeline = options.device.createRenderPipeline(finalDescriptor);
    const validationMessage = await popPickPipelineErrorScope(options.device);

    if (validationMessage !== null) {
      return {
        valid: false,
        resource: null,
        diagnostics: [
          {
            code: "idBufferPick.pipelineCreationFailed",
            message: validationMessage,
          },
        ],
      };
    }

    return {
      valid: true,
      resource: {
        cacheKey: webGpuIdBufferPickPipelineCacheKey(options.batchKey),
        shaderModule: shaderModule.module,
        pipeline,
        descriptor: finalDescriptor,
        layouts: layout.layouts,
      },
      diagnostics: [],
    };
  } catch (cause) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "idBufferPick.pipelineCreationFailed",
          message:
            cause instanceof Error
              ? cause.message
              : "WebGPU ID-buffer picking pipeline creation failed.",
        },
      ],
    };
  }
}

function pushPickPipelineErrorScope(
  device: WebGpuIdBufferPickPipelineDeviceLike,
): void {
  try {
    device.pushErrorScope?.("validation");
  } catch {
    // Best effort validation diagnostics.
  }
}

async function popPickPipelineErrorScope(
  device: WebGpuIdBufferPickPipelineDeviceLike,
): Promise<string | null> {
  if (device.popErrorScope === undefined) {
    return null;
  }

  try {
    const error = await device.popErrorScope();

    return error?.message ?? null;
  } catch {
    return null;
  }
}

function createPickPipelineLayout(
  device: WebGpuIdBufferPickPipelineDeviceLike,
): {
  readonly layout: unknown;
  readonly layouts: WebGpuIdBufferPickPipelineResource["layouts"];
  readonly diagnostics: readonly WebGpuIdBufferPickDiagnostic[];
} {
  if (
    device.createBindGroupLayout === undefined ||
    device.createPipelineLayout === undefined
  ) {
    return {
      layout: null as unknown,
      layouts: null as unknown as WebGpuIdBufferPickPipelineResource["layouts"],
      diagnostics: [
        {
          code: "idBufferPick.pipelineLayoutUnavailable",
          message:
            "ID-buffer picking requires createBindGroupLayout and createPipelineLayout to share frame bind groups.",
        },
      ],
    };
  }

  const shaderStage = (
    globalThis as { readonly GPUShaderStage?: { readonly VERTEX?: number } }
  ).GPUShaderStage;
  const vertexVisibility = shaderStage?.VERTEX ?? 0x1;
  const viewLayout = device.createBindGroupLayout({
    label: "aperture/id-buffer-pick/group-0",
    entries: [
      {
        binding: 0,
        visibility: vertexVisibility,
        buffer: { type: "uniform" },
      },
    ],
  });
  const worldLayout = device.createBindGroupLayout({
    label: "aperture/id-buffer-pick/group-1",
    entries: [
      {
        binding: 0,
        visibility: vertexVisibility,
        buffer: { type: "read-only-storage" },
      },
    ],
  });
  const idLayout = device.createBindGroupLayout({
    label: "aperture/id-buffer-pick/group-2",
    entries: [
      {
        binding: 0,
        visibility: vertexVisibility,
        buffer: { type: "read-only-storage" },
      },
    ],
  });
  const layouts = {
    view: viewLayout,
    worldTransforms: worldLayout,
    ids: idLayout,
  };

  return {
    layout: device.createPipelineLayout({
      label: "aperture/id-buffer-pick/layout",
      bindGroupLayouts: [viewLayout, worldLayout, idLayout],
    }),
    layouts,
    diagnostics: [],
  };
}

export function webGpuIdBufferPickPipelineCacheKey(
  batchKey: BatchCompatibilityKey,
): string {
  return [
    "id-buffer-pick",
    WEBGPU_ID_BUFFER_FORMAT,
    batchKey.pipelineKey,
    batchKey.meshLayoutKey,
    batchKey.topology,
    batchKey.skinned ? "skinned" : "rigid",
    batchKey.morphed ? "morphed" : "static",
  ].join("|");
}

export function createWebGpuIdBufferPickIdStorageValues(
  snapshot: Pick<RenderSnapshot, "meshDraws" | "transforms">,
): Uint32Array {
  const transformCount = Math.max(
    1,
    Math.floor(snapshot.transforms.length / 16),
  );
  const ids = new Uint32Array(transformCount);

  ids.fill(WEBGPU_ID_BUFFER_EMPTY_ID);

  for (const draw of snapshot.meshDraws) {
    const transformIndex = draw.worldTransformOffset / 16;

    if (
      Number.isInteger(transformIndex) &&
      transformIndex >= 0 &&
      transformIndex < ids.length
    ) {
      ids[transformIndex] = createWebGpuIdBufferIdForEntity(draw.entity);
    }
  }

  return ids;
}

export function createWebGpuIdBufferPickIdStorage(options: {
  readonly device: WebGpuBufferDeviceLike;
  readonly snapshot: Pick<RenderSnapshot, "meshDraws" | "transforms">;
}): CreateWebGpuIdBufferPickIdStorageResult {
  const ids = createWebGpuIdBufferPickIdStorageValues(options.snapshot);
  const result = createWebGpuBuffer({
    device: options.device,
    descriptor: {
      label: "aperture/id-buffer-pick-ids",
      size: ids.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: ids,
    },
  });

  if (!result.ok) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "idBufferPick.createBufferFailed",
          message: result.message,
        },
      ],
    };
  }

  return {
    valid: true,
    resource: {
      resourceKey: "id-buffer-pick/ids",
      buffer: result.buffer,
      ids,
    },
    diagnostics: [],
  };
}

export function createWebGpuIdBufferPickBindGroup(options: {
  readonly device: WebGpuIdBufferPickBindGroupDeviceLike;
  readonly pipeline: WebGpuIdBufferPickPipelineResource;
  readonly ids: WebGpuIdBufferPickIdStorageResource;
}): CreateWebGpuIdBufferPickBindGroupResult {
  if (options.device.createBindGroup === undefined) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "idBufferPick.createBindGroupUnavailable",
          message: "WebGPU ID-buffer picking requires createBindGroup.",
        },
      ],
    };
  }

  const pipeline = options.pipeline.pipeline as {
    getBindGroupLayout?: (group: number) => unknown;
  };
  const layout =
    options.pipeline.layouts.ids ?? pipeline.getBindGroupLayout?.(2);

  if (layout === undefined) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "idBufferPick.pipelineLayoutUnavailable",
          message:
            "WebGPU ID-buffer picking pipeline did not expose group 2 layout.",
        },
      ],
    };
  }

  try {
    return {
      valid: true,
      resource: {
        group: 2,
        resourceKey: options.ids.resourceKey,
        bindGroup: options.device.createBindGroup({
          label: "aperture/id-buffer-pick-ids",
          layout,
          entries: [
            {
              binding: 0,
              resource: { buffer: options.ids.buffer },
            },
          ],
        }),
      },
      diagnostics: [],
    };
  } catch (cause) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "idBufferPick.createBindGroupFailed",
          message:
            cause instanceof Error
              ? cause.message
              : "WebGPU ID-buffer picking bind group creation failed.",
        },
      ],
    };
  }
}

export function createWebGpuIdBufferPickTexture(options: {
  readonly device: WebGpuIdBufferPickTextureDeviceLike;
  readonly width: number;
  readonly height: number;
}): CreateWebGpuIdBufferPickTextureResult {
  if (options.device.createTexture === undefined) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "idBufferPick.createTextureUnavailable",
          message: "WebGPU ID-buffer picking requires createTexture.",
        },
      ],
    };
  }

  try {
    const texture = options.device.createTexture({
      label: "aperture/id-buffer-pick-target",
      size: { width: options.width, height: options.height },
      format: WEBGPU_ID_BUFFER_FORMAT,
      usage: 0x1 | 0x10,
    });
    const resource: WebGpuIdBufferPickTextureResource = {
      texture,
      width: options.width,
      height: options.height,
      format: WEBGPU_ID_BUFFER_FORMAT,
    };

    if (texture.destroy !== undefined) {
      return {
        valid: true,
        resource: {
          ...resource,
          destroy: texture.destroy.bind(texture),
        },
        diagnostics: [],
      };
    }

    return {
      valid: true,
      resource,
      diagnostics: [],
    };
  } catch (cause) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "idBufferPick.createTextureUnavailable",
          message:
            cause instanceof Error
              ? cause.message
              : "WebGPU ID-buffer picking texture creation failed.",
        },
      ],
    };
  }
}

export function createWebGpuIdBufferPickCommands(options: {
  readonly commands: readonly RenderPassCommand[];
  readonly pipelineByKey: ReadonlyMap<
    string,
    WebGpuIdBufferPickPipelineResource
  >;
  readonly viewBindGroup: WebGpuIdBufferPickBindGroupResource;
  readonly worldTransformBindGroup: WebGpuIdBufferPickBindGroupResource;
  readonly idBindGroup: WebGpuIdBufferPickBindGroupResource;
}): {
  readonly valid: boolean;
  readonly commands: readonly RenderPassCommand[];
  readonly diagnostics: readonly WebGpuIdBufferPickDiagnostic[];
} {
  const commands: RenderPassCommand[] = [];
  const diagnostics: WebGpuIdBufferPickDiagnostic[] = [];

  for (const command of options.commands) {
    if (command.kind === "setPipeline") {
      const pipeline = options.pipelineByKey.get(command.pipelineKey);

      if (pipeline === undefined) {
        diagnostics.push({
          code: "idBufferPick.missingPickPipeline",
          renderId: command.renderId,
          pipelineKey: command.pipelineKey,
          message: `Missing ID-buffer picking pipeline for '${command.pipelineKey}'.`,
        });
        continue;
      }

      commands.push({
        kind: "setPipeline",
        renderId: command.renderId,
        pipelineKey: pipeline.cacheKey,
        pipeline: pipeline.pipeline,
      });
      continue;
    }

    if (command.kind === "setBindGroup") {
      continue;
    }

    if (command.kind === "draw" || command.kind === "drawIndexed") {
      commands.push({
        kind: "setBindGroup",
        renderId: command.renderId,
        index: options.viewBindGroup.group,
        resourceKey: options.viewBindGroup.resourceKey,
        bindGroup: options.viewBindGroup.bindGroup,
      });
      commands.push({
        kind: "setBindGroup",
        renderId: command.renderId,
        index: options.worldTransformBindGroup.group,
        resourceKey: options.worldTransformBindGroup.resourceKey,
        bindGroup: options.worldTransformBindGroup.bindGroup,
      });
      commands.push({
        kind: "setBindGroup",
        renderId: command.renderId,
        index: options.idBindGroup.group,
        resourceKey: options.idBindGroup.resourceKey,
        bindGroup: options.idBindGroup.bindGroup,
      });
      commands.push(command);
      continue;
    }

    commands.push(command);
  }

  return { valid: diagnostics.length === 0, commands, diagnostics };
}

export async function readWebGpuIdBufferPickPixel(options: {
  readonly device: WebGpuIdBufferPickReadbackDeviceLike;
  readonly texture: unknown;
  readonly width: number;
  readonly height: number;
  readonly x: number;
  readonly y: number;
  readonly mapModeRead?: number;
}): Promise<WebGpuIdBufferPickReadbackResult> {
  const origin = {
    x: Math.floor(options.x),
    y: Math.floor(options.y),
  };

  if (
    !Number.isInteger(options.width) ||
    !Number.isInteger(options.height) ||
    options.width <= 0 ||
    options.height <= 0 ||
    origin.x < 0 ||
    origin.y < 0 ||
    origin.x >= options.width ||
    origin.y >= options.height
  ) {
    return {
      ok: false,
      reason: "idBufferPick.invalidReadbackOrigin",
      message: `ID-buffer pick origin ${origin.x},${origin.y} is outside the ${options.width}x${options.height} target.`,
      origin,
    };
  }

  const encoder = options.device.createCommandEncoder?.();

  if (
    encoder?.copyTextureToBuffer === undefined ||
    encoder.finish === undefined
  ) {
    return {
      ok: false,
      reason: "idBufferPick.copyTextureToBufferUnavailable",
      message: "WebGPU ID-buffer picking requires copyTextureToBuffer.",
      origin,
    };
  }

  const buffer = options.device.createBuffer?.({
    label: "aperture/id-buffer-pick-readback",
    size: readbackBytesPerRow,
    usage: WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST | 0x1,
  });

  if (buffer === undefined) {
    return {
      ok: false,
      reason: "idBufferPick.createReadbackBufferUnavailable",
      message: "WebGPU ID-buffer picking requires a mappable readback buffer.",
      origin,
    };
  }

  try {
    encoder.copyTextureToBuffer(
      {
        texture: options.texture,
        origin: { x: origin.x, y: origin.y, z: 0 },
      },
      { buffer, bytesPerRow: readbackBytesPerRow, rowsPerImage: 1 },
      { width: 1, height: 1, depthOrArrayLayers: 1 },
    );
    options.device.queue?.submit?.([encoder.finish()]);
  } catch (cause) {
    return {
      ok: false,
      reason: "idBufferPick.copyTextureToBufferUnavailable",
      message:
        cause instanceof Error
          ? cause.message
          : "WebGPU ID-buffer picking copy failed.",
      origin,
    };
  }

  if (buffer.mapAsync === undefined) {
    return {
      ok: false,
      reason: "idBufferPick.mapReadUnavailable",
      message: "WebGPU ID-buffer picking readback buffer cannot be mapped.",
      origin,
    };
  }

  if (buffer.getMappedRange === undefined) {
    return {
      ok: false,
      reason: "idBufferPick.mappedRangeUnavailable",
      message:
        "WebGPU ID-buffer picking readback buffer cannot expose mapped bytes.",
      origin,
    };
  }

  try {
    await buffer.mapAsync(options.mapModeRead ?? 0x1);
  } catch (cause) {
    return {
      ok: false,
      reason: "idBufferPick.readbackMapFailed",
      message:
        cause instanceof Error
          ? cause.message
          : "WebGPU ID-buffer picking readback map failed.",
      origin,
    };
  }

  try {
    const bytes = mappedRangeBytes(buffer.getMappedRange());
    const id = new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    ).getUint32(0, true);

    return { ok: true, id, origin, bytesPerRow: readbackBytesPerRow };
  } catch (cause) {
    return {
      ok: false,
      reason: "idBufferPick.mappedRangeUnavailable",
      message:
        cause instanceof Error
          ? cause.message
          : "WebGPU ID-buffer picking mapped bytes could not be decoded.",
      origin,
    };
  } finally {
    buffer.unmap?.();
  }
}

function validatePickBatchKey(
  batchKey: BatchCompatibilityKey,
): WebGpuIdBufferPickDiagnostic | null {
  if (batchKey.topology !== "triangle-list") {
    return {
      code: "idBufferPick.unsupportedBatchKey",
      pipelineKey: batchKey.pipelineKey,
      message: `ID-buffer picking currently supports triangle-list topology, not '${batchKey.topology}'.`,
    };
  }

  if (batchKey.skinned || batchKey.morphed) {
    return {
      code: "idBufferPick.unsupportedBatchKey",
      pipelineKey: batchKey.pipelineKey,
      message:
        "ID-buffer picking currently supports rigid, unmorphed mesh draws.",
    };
  }

  if (!hasSupportedPickMeshLayout(batchKey.meshLayoutKey)) {
    return {
      code: "idBufferPick.unsupportedBatchKey",
      pipelineKey: batchKey.pipelineKey,
      message: `ID-buffer picking currently supports mesh layouts with POSITION, NORMAL, TEXCOORD_0, and optional COLOR_0, not '${batchKey.meshLayoutKey}'.`,
    };
  }

  return null;
}

function hasSupportedPickMeshLayout(meshLayoutKey: string): boolean {
  const tokens = meshLayoutKey.split(/[|,]/);
  const semantics = new Set(
    tokens.map(meshLayoutTokenSemantic).filter(isNonEmptyString),
  );

  return (
    semantics.has("POSITION") &&
    semantics.has("NORMAL") &&
    semantics.has("TEXCOORD_0")
  );
}

function meshLayoutTokenSemantic(token: string): string {
  if (token.startsWith("stride=")) {
    return "";
  }

  return token.split("@")[0]?.split(":")[0] ?? "";
}

function isNonEmptyString(value: string | undefined): value is string {
  return value !== undefined && value.length > 0;
}

function mappedRangeBytes(range: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (ArrayBuffer.isView(range)) {
    return new Uint8Array(range.buffer, range.byteOffset, range.byteLength);
  }

  return new Uint8Array(range);
}
