import type {
  BoundsPacket,
  RenderSnapshot,
  ShadowRequestPacket,
} from "@aperture-engine/render";

import {
  invertMat4,
  multiplyMat4,
  transformPoint,
  type Mat4Like,
} from "@aperture-engine/simulation";
import { createWebGpuBuffer } from "../gpu/buffer.js";
import type { WebGpuBufferDeviceLike } from "../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../resources/meshes/mesh-buffer-descriptors.js";
import type { CommandEncoderFinishLike } from "../gpu/command-buffer.js";
import {
  createCommandEncoderResource,
  type CommandEncoderDeviceLike,
} from "../gpu/command-encoder.js";
import type { RenderPassCommandEncoderLike } from "../render/passes/render-pass-lifecycle.js";
import type { QueueSubmitLike } from "../render/queues/queue-submit.js";
import type { TextureGpuDeviceLike } from "../resources/textures/texture-resources.js";
import {
  createShadowSamplerResourceReport,
  type ShadowSamplerDeviceLike,
  type ShadowSamplerResource,
} from "../materials/standard/standard-material-shadow-bind-group.js";
import type { StandardFrameShadowReceiverResources } from "../materials/standard/standard-frame-resources.js";
import {
  createDirectionalShadowMatrixComputationReport,
  directionalShadowMatrixComputationReportToJsonValue,
  type DirectionalShadowCasterBoundsInput,
  type DirectionalShadowMatrixComputationReport,
} from "./directional-shadow-matrix-computation.js";
import {
  createDirectionalShadowViewProjectionPlanReport,
  directionalShadowViewProjectionPlanReportToJsonValue,
  type DirectionalShadowViewProjectionPlanReport,
} from "./directional-shadow-view-projection-plan.js";
import {
  createShadowCasterCommandPlanReadinessReport,
  shadowCasterCommandPlanReadinessReportToJsonValue,
  type ShadowCasterCommandPlanReadinessReport,
} from "./shadow-caster-command-plan-readiness.js";
import {
  createShadowCasterCommandRecordPlanReport,
  shadowCasterCommandRecordPlanReportToJsonValue,
  type ShadowCasterCommandRecordPlanReport,
  type ShadowCasterExecutableMeshResourceView,
} from "./shadow-caster-command-record-plan.js";
import {
  createShadowCasterDrawListPlanReport,
  shadowCasterDrawListPlanReportToJsonValue,
  type ShadowCasterDrawListPlanReport,
} from "./shadow-caster-draw-list-plan.js";
import {
  createShadowCasterFrameResourceReadinessReport,
  shadowCasterFrameResourceReadinessReportToJsonValue,
  type ShadowCasterFrameResourceReadinessReport,
  type ShadowCasterPreparedMeshResourceView,
} from "./shadow-caster-frame-resource-readiness.js";
import {
  createShadowCasterMatrixBindGroupResourceReport,
  createShadowCasterMatrixBindGroupLayoutDescriptor,
  type ShadowCasterMatrixBindGroupResource,
  type ShadowCasterMatrixBindGroupResourceReport,
  type ShadowCasterMatrixBindGroupDeviceLike,
} from "./shadow-caster-matrix-bind-group-resource.js";
import {
  createShadowCasterPipelineDescriptorReport,
  shadowCasterPipelineDescriptorReportToJsonValue,
  type ShadowCasterPipelineDescriptorReport,
} from "./shadow-caster-pipeline-descriptor.js";
import {
  createShadowCasterPipelineResourceReport,
  type ShadowCasterPipelineDeviceLike,
  type ShadowCasterPipelineResource,
  type ShadowCasterPipelineResourceReport,
} from "./shadow-caster-pipeline-resource.js";
import {
  createShadowDepthTextureResourceReport,
  resolveShadowDepthTextureAttachmentView,
  shadowDepthTextureResourceReportToJsonValue,
  type ShadowDepthTextureResourceCache,
  type ShadowDepthTextureResourceReport,
} from "./shadow-depth-texture-resource.js";
import {
  createShadowMapDescriptorReport,
  shadowMapDescriptorReportToJsonValue,
  type ShadowMapDescriptorReport,
  type ShadowMapDescriptorSource,
} from "./shadow-map-descriptor.js";
import {
  createShadowMatrixBufferDescriptorReport,
  shadowMatrixBufferDescriptorReportToJsonValue,
  type ShadowMatrixBufferDescriptorReport,
} from "./shadow-matrix-buffer-descriptor.js";
import {
  createShadowMatrixBufferResourceReport,
  type ShadowMatrixBufferResource,
  type ShadowMatrixBufferResourceReport,
} from "./shadow-matrix-buffer-resource.js";
import {
  createShadowPassAttachmentDescriptorReport,
  shadowPassAttachmentDescriptorReportToJsonValue,
  type ShadowPassAttachmentDescriptorReport,
} from "./shadow-pass-attachment-descriptor.js";
import {
  createShadowPassCommandBufferSubmissionReport,
  shadowPassCommandBufferSubmissionReportToJsonValue,
  type ShadowPassCommandBufferSubmissionReport,
} from "./shadow-pass-command-buffer-submission-report.js";
import {
  createShadowPassCommandEncodingReport,
  shadowPassCommandEncodingReportToJsonValue,
  type ShadowPassCommandEncodingReport,
} from "./shadow-pass-command-encoding-report.js";
import {
  createShadowPassEncoderAssemblyReport,
  shadowPassEncoderAssemblyReportToJsonValue,
  type ShadowPassEncoderAssemblyReport,
} from "./shadow-pass-encoder-assembly-report.js";
import {
  createShadowPassPlanReport,
  shadowPassPlanReportToJsonValue,
  type ShadowPassPlanReport,
} from "./shadow-pass-plan.js";
import {
  createShadowTextureResourceReport,
  shadowTextureResourceReportToJsonValue,
  type ShadowTextureResourceReport,
} from "./shadow-texture-resource.js";

export interface RenderShadowFrameDeviceLike extends CommandEncoderDeviceLike {
  readonly createTexture?: NonNullable<TextureGpuDeviceLike["createTexture"]>;
  readonly createSampler?: NonNullable<
    TextureGpuDeviceLike["createSampler"] &
      ShadowSamplerDeviceLike["createSampler"]
  >;
  readonly createBuffer?: NonNullable<WebGpuBufferDeviceLike["createBuffer"]>;
  readonly createShaderModule?: NonNullable<
    ShadowCasterPipelineDeviceLike["createShaderModule"]
  >;
  readonly createRenderPipeline?: NonNullable<
    ShadowCasterPipelineDeviceLike["createRenderPipeline"]
  >;
  readonly createBindGroupLayout?: (descriptor: unknown) => unknown;
  readonly createPipelineLayout?: NonNullable<
    ShadowCasterPipelineDeviceLike["createPipelineLayout"]
  >;
  readonly createBindGroup?: NonNullable<
    ShadowCasterMatrixBindGroupDeviceLike["createBindGroup"]
  >;
  readonly queue?: TextureGpuDeviceLike["queue"] &
    WebGpuBufferDeviceLike["queue"] &
    QueueSubmitLike;
}

export type RenderShadowFrameShadowKind = NonNullable<
  StandardFrameShadowReceiverResources["shadowKind"]
>;

export interface RenderShadowFrameCache {
  readonly shadowDepthTextures?: ShadowDepthTextureResourceCache;
  readonly shadowMatrixBuffers?: Map<string, ShadowMatrixBufferResource>;
  readonly shadowSamplers?: Map<string, ShadowSamplerResource>;
  readonly shadowCasterPipelines?: Map<string, ShadowCasterPipelineResource>;
  readonly shadowCasterMatrixBindGroups?: Map<
    string,
    ShadowCasterMatrixBindGroupResource
  >;
}

export interface RenderShadowFrameShadowMapOptions {
  readonly mapSize?: number;
  readonly depthBias?: number;
  readonly normalBias?: number;
  readonly filterRadiusTexels?: number;
  readonly cascadeCount?: number;
  readonly resourceKey?: string;
}

export interface RenderShadowFrameMatrixOptions {
  /** Fallback center used only when no primary render camera can drive auto-fit. */
  readonly center?: readonly [number, number, number];
  /** Fallback span used only when no primary render camera can drive auto-fit. */
  readonly orthographicSize?: number;
  readonly near?: number;
  readonly far?: number;
  readonly lightDistance?: number;
}

export interface CreateRenderShadowFrameOptions {
  readonly device: RenderShadowFrameDeviceLike;
  readonly snapshot: RenderSnapshot;
  readonly preparedMeshes: readonly ShadowCasterPreparedMeshResourceView[];
  readonly executableMeshes: readonly ShadowCasterExecutableMeshResourceView[];
  readonly cache?: RenderShadowFrameCache;
  readonly shadowMap?: RenderShadowFrameShadowMapOptions;
  readonly matrix?: RenderShadowFrameMatrixOptions;
  readonly label?: string;
  readonly submit?: boolean;
}

export interface RenderShadowFrameResult {
  readonly receiverResources: StandardFrameShadowReceiverResources | null;
  readonly report: RenderShadowFrameReport;
  readonly descriptor: ShadowMapDescriptorReport;
  readonly textures: ShadowTextureResourceReport;
  readonly depthTextureResources: ShadowDepthTextureResourceReport;
  readonly samplerResource: ReturnType<
    typeof createShadowSamplerResourceReport
  >;
  readonly passPlan: ShadowPassPlanReport;
  readonly passAttachments: ShadowPassAttachmentDescriptorReport;
  readonly viewProjection: DirectionalShadowViewProjectionPlanReport;
  readonly matrixComputation: DirectionalShadowMatrixComputationReport;
  readonly matrixBuffer: ShadowMatrixBufferDescriptorReport;
  readonly matrixBufferResource: ShadowMatrixBufferResourceReport;
  readonly casterDrawList: ShadowCasterDrawListPlanReport;
  readonly commandPlan: ShadowCasterCommandPlanReadinessReport;
  readonly commandEncoding: ShadowPassCommandEncodingReport;
  readonly pipelineDescriptor: ShadowCasterPipelineDescriptorReport;
  readonly pipelineResource: ShadowCasterPipelineResourceReport;
  readonly matrixBindGroupResource: ShadowCasterMatrixBindGroupResourceReport;
  readonly frameResources: ShadowCasterFrameResourceReadinessReport;
  readonly commandRecords: ShadowCasterCommandRecordPlanReport;
  readonly encoderAssembly: ShadowPassEncoderAssemblyReport;
  readonly commandBufferSubmission: ShadowPassCommandBufferSubmissionReport;
}

export interface RenderShadowFrameReport {
  readonly ready: boolean;
  readonly status: "submitted" | "ready" | "missing" | "not-required";
  readonly shadowKind: RenderShadowFrameShadowKind | null;
  readonly requestCount: number;
  readonly passCount: number;
  readonly drawCalls: number;
  readonly depthTextureKeys: readonly string[];
  readonly matrixBufferResourceKey: string | null;
  readonly sections: {
    readonly shadowRequests: boolean;
    readonly depthTextureResources: boolean;
    readonly matrixBufferResource: boolean;
    readonly samplerResource: boolean;
    readonly pipelineResource: boolean;
    readonly matrixBindGroupResource: boolean;
    readonly commandBufferSubmission: boolean;
    readonly receiverResources: boolean;
  };
  readonly resourceReuse: {
    readonly depthTexturesCreated: number;
    readonly depthTexturesReused: number;
    readonly matrixBuffersCreated: number;
    readonly matrixBuffersReused: number;
    readonly samplersCreated: number;
    readonly samplersReused: number;
    readonly pipelinesCreated: number;
    readonly pipelinesReused: number;
    readonly matrixBindGroupsCreated: number;
    readonly matrixBindGroupsReused: number;
  };
  readonly commandBufferSubmission: {
    readonly status: ShadowPassCommandBufferSubmissionReport["status"];
    readonly assembledPasses: number;
    readonly commandBuffers: number;
    readonly submittedCommandBuffers: number;
    readonly commandBufferKeys: readonly string[];
    readonly sections: ShadowPassCommandBufferSubmissionReport["sections"];
  };
  readonly diagnostics: readonly RenderShadowFrameDiagnostic[];
}

export interface RenderShadowFrameDiagnostic {
  readonly stage: string;
  readonly code: string;
  readonly severity: "warning" | "error";
  readonly message: string;
}

const DEFAULT_SHADOW_MAP_SIZE = 1024;
const DEFAULT_DEPTH_BIAS = 0.001;
const MATRIX_FLOAT_COUNT = 16;
const EPSILON = 1e-6;

export function createRenderShadowFrame(
  options: CreateRenderShadowFrameOptions,
): RenderShadowFrameResult {
  const shadowRequests = options.snapshot.shadowRequests.filter(
    isDirectionalShadowRequest,
  );
  const descriptor = createShadowMapDescriptorReport({
    shadowRequests,
    descriptors: shadowRequests.map((request) =>
      createDirectionalShadowDescriptor(request, options.shadowMap),
    ),
  });
  const textures = createShadowTextureResourceReport({
    descriptors: descriptor,
  });
  const depthTextureResources = createShadowDepthTextureResourceReport({
    device: options.device,
    textures,
    ...(options.cache?.shadowDepthTextures === undefined
      ? {}
      : { cache: options.cache.shadowDepthTextures }),
  });
  const samplerResource = createShadowSamplerResourceReport({
    device: options.device,
    resourceKey: "shadow-sampler:directional",
    ...(options.cache?.shadowSamplers === undefined
      ? {}
      : { cache: options.cache.shadowSamplers }),
  });
  const passPlan = createShadowPassPlanReport({
    shadowRequests,
    textures,
    submission: "ready",
  });
  const passAttachments = createShadowPassAttachmentDescriptorReport({
    shadowPassPlan: passPlan,
    depthTextureResources,
  });
  const shadowCamera = resolvePrimaryShadowCamera(options.snapshot);
  const viewProjection = createDirectionalShadowViewProjectionPlanReport({
    shadowRequests,
    lights: options.snapshot.lights,
    shadowPassPlan: passPlan,
    computation: "ready",
    ...(shadowCamera === null
      ? {}
      : {
          cameraNear: shadowCamera.near,
          cameraFar: shadowCamera.far,
          shadowMaxDistance: shadowCamera.far,
        }),
  });
  const casterDrawList = createShadowCasterDrawListPlanReport({
    shadowRequests,
    meshDraws: options.snapshot.meshDraws,
    shadowPassPlan: passPlan,
    commandEncoding: "ready",
  });
  const matrixComputation = createDirectionalShadowMatrixComputationReport({
    viewProjection,
    transforms: options.snapshot.transforms,
    ...(shadowCamera === null
      ? {}
      : {
          cameraViewMatrix: shadowCamera.viewMatrix,
          cameraProjectionMatrix: shadowCamera.projectionMatrix,
        }),
    casterBounds: createDirectionalShadowCasterBounds({
      casterDrawList,
      bounds: options.snapshot.bounds,
    }),
    ...(options.matrix?.center === undefined
      ? {}
      : { center: options.matrix.center }),
    ...(options.matrix?.orthographicSize === undefined
      ? {}
      : { orthographicSize: options.matrix.orthographicSize }),
    ...(options.matrix?.near === undefined
      ? {}
      : { near: options.matrix.near }),
    ...(options.matrix?.far === undefined ? {} : { far: options.matrix.far }),
    ...(options.matrix?.lightDistance === undefined
      ? {}
      : { lightDistance: options.matrix.lightDistance }),
  });
  const matrixBuffer = createShadowMatrixBufferDescriptorReport({
    viewProjection,
    upload: "ready",
    resourceKey: "shadow-matrix-buffer:directional",
    label: "DirectionalShadowMatrices/storage",
  });
  const matrixBufferResource = createShadowMatrixBufferResourceReport({
    device: options.device,
    descriptor: matrixBuffer,
    matrices: matrixComputation,
    ...(options.cache?.shadowMatrixBuffers === undefined
      ? {}
      : { cache: options.cache.shadowMatrixBuffers }),
  });
  const commandPlan = createShadowCasterCommandPlanReadinessReport({
    shadowPassPlan: passPlan,
    viewProjection,
    matrixBuffer,
    casterDrawList,
    commandEncoding: "ready",
  });
  const commandEncoding = createShadowPassCommandEncodingReport({
    shadowPassPlan: passPlan,
    depthTextureResources,
    matrixBufferResource,
    casterDrawList,
    commandPlan,
    commandEncoding: "ready",
  });
  // three.js shadowSide parity: emit one caster pipeline per distinct cull mode
  // present in the frame (single-sided -> "front"/render back faces, the primary
  // self-shadow defense; double-sided -> "none"). Resolved per draw upstream.
  const casterCullModes = [
    ...new Set(
      casterDrawList.lists.flatMap((list) =>
        list.draws.map((draw) => draw.casterCullMode),
      ),
    ),
  ];
  const pipelineDescriptor = createShadowCasterPipelineDescriptorReport({
    commandEncoding,
    casterDrawList,
    ...(casterCullModes.length > 0 ? { casterCullModes } : {}),
    ...maxAuthoredCasterSlopeBias(shadowRequests),
  });
  const pipelineResource = createShadowCasterPipelineResourceReport({
    device: options.device,
    descriptor: pipelineDescriptor,
    ...(options.cache?.shadowCasterPipelines === undefined
      ? {}
      : { cache: options.cache.shadowCasterPipelines }),
  });
  const matrixBindGroupResource =
    createShadowCasterMatrixBindGroupResourceReport({
      device: options.device,
      matrixBufferResource,
      ...(pipelineResource.resource?.matrixBindGroupLayout === undefined
        ? {}
        : { layout: pipelineResource.resource.matrixBindGroupLayout }),
      ...(options.cache?.shadowCasterMatrixBindGroups === undefined
        ? {}
        : { cache: options.cache.shadowCasterMatrixBindGroups }),
    });
  const frameResources = createShadowCasterFrameResourceReadinessReport({
    casterDrawList,
    preparedMeshes: options.preparedMeshes,
    matrixBufferResource,
    pipelineDescriptor,
  });
  // Casters must render WORLD-space geometry into the depth map, but the shared
  // matrix buffer (also read by the receiver) holds only the pure lightVP. Bake
  // a SEPARATE caster-only buffer where entry = lightVP_pass * worldMatrix and
  // point each caster draw's firstInstance at its baked entry. The receiver's
  // pure-lightVP buffer is left untouched.
  const bakedCaster = buildBakedCasterMatrices({
    device: options.device,
    casterDrawList,
    matrices: matrixComputation,
    transforms: options.snapshot.transforms,
  });
  const bakedCasterBindGroup = createBakedCasterBindGroup(
    options.device,
    bakedCaster,
    pipelineResource.resource?.matrixBindGroupLayout,
  );

  const commandRecords = createShadowCasterCommandRecordPlanReport({
    frameResources,
    commandPlan,
    pipelines: pipelineResource.resources.map((resource) => ({
      pipelineKey: resource.pipelineKey,
      resourceKey: resource.resourceKey,
      pipeline: resource.pipeline,
    })),
    matrixBindGroups:
      matrixBindGroupResource.resource === null
        ? []
        : [
            {
              matrixResourceKey:
                matrixBindGroupResource.resource.matrixResourceKey,
              resourceKey: matrixBindGroupResource.resource.resourceKey,
              group: matrixBindGroupResource.resource.group,
              bindGroup: matrixBindGroupResource.resource.bindGroup,
            },
          ],
    meshes: options.executableMeshes,
    ...(bakedCaster === null || bakedCasterBindGroup === null
      ? {}
      : {
          bakedMatrixIndexByPassDraw: bakedCaster.indexByPassDraw,
          bakedMatrixBindGroup: bakedCasterBindGroup,
        }),
  });
  const encoderResource = createCommandEncoderResource({
    device: options.device,
    label: options.label ?? "shadow-pass:directional",
  });
  const encoder = encoderResource.resource?.encoder as
    | (RenderPassCommandEncoderLike & CommandEncoderFinishLike)
    | undefined;
  const encoderAssembly = createShadowPassEncoderAssemblyReport({
    attachments: passAttachments,
    frameResources,
    commandEncoding,
    commands: commandRecords.commandRecords,
    ...(encoder === undefined ? {} : { encoder }),
    resolveDepthView: (attachment) =>
      resolveShadowDepthTextureAttachmentView(
        depthTextureResources,
        attachment,
      ),
  });
  const commandBufferSubmission = createShadowPassCommandBufferSubmissionReport(
    {
      assembly: encoderAssembly,
      ...(encoder === undefined ? {} : { encoder }),
      ...(options.device.queue === undefined
        ? {}
        : { queue: options.device.queue }),
      label: options.label ?? "shadow-pass:directional",
      submit: options.submit ?? true,
    },
  );
  const receiverResources = createReceiverResources({
    shadowKind: resolveShadowKind(descriptor),
    matrixBufferResource,
    depthTextureResources,
    samplerResource,
  });
  const report = createRenderShadowFrameReport({
    shadowKind: receiverResources?.shadowKind ?? null,
    shadowRequests,
    depthTextureResources,
    matrixBufferResource,
    samplerResource,
    pipelineResource,
    matrixBindGroupResource,
    commandBufferSubmission,
    receiverResources,
    stages: {
      descriptor,
      textures,
      depthTextureResources,
      samplerResource,
      passPlan,
      passAttachments,
      viewProjection,
      matrixComputation,
      matrixBuffer,
      matrixBufferResource,
      casterDrawList,
      commandPlan,
      commandEncoding,
      pipelineDescriptor,
      pipelineResource,
      matrixBindGroupResource,
      frameResources,
      commandRecords,
      encoderAssembly,
      commandBufferSubmission,
    },
  });

  return {
    receiverResources,
    report,
    descriptor,
    textures,
    depthTextureResources,
    samplerResource,
    passPlan,
    passAttachments,
    viewProjection,
    matrixComputation,
    matrixBuffer,
    matrixBufferResource,
    casterDrawList,
    commandPlan,
    commandEncoding,
    pipelineDescriptor,
    pipelineResource,
    matrixBindGroupResource,
    frameResources,
    commandRecords,
    encoderAssembly,
    commandBufferSubmission,
  };
}

function createDirectionalShadowCasterBounds(input: {
  readonly casterDrawList: ShadowCasterDrawListPlanReport;
  readonly bounds: readonly BoundsPacket[];
}): readonly DirectionalShadowCasterBoundsInput[] {
  if (
    input.casterDrawList.status === "not-required" ||
    input.casterDrawList.listCount === 0
  ) {
    return [];
  }

  return input.casterDrawList.lists.map((list) => ({
    passKey: list.passKey,
    bounds: list.draws.flatMap((draw) => {
      const bounds = input.bounds[draw.boundsIndex];

      if (bounds === undefined) {
        return [];
      }

      return [
        {
          min: bounds.worldAabb.min,
          max: bounds.worldAabb.max,
        },
      ];
    }),
  }));
}

const BAKED_CASTER_MATRIX_FLOATS = 16;
const BAKED_CASTER_IDENTITY = new Float32Array([
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
]);

interface BakedCasterMatrices {
  readonly buffer: unknown;
  readonly resourceKey: string;
  /** `${passKey}:${renderId}` -> baked entry index (firstInstance = index). */
  readonly indexByPassDraw: ReadonlyMap<string, number>;
}

/**
 * Builds a caster-only matrix buffer where entry[k] = lightVP_pass * worldMatrix
 * for each included (passKey, renderId) caster draw, so the caster vertex shader
 * (`matrices[instanceIndex] * localPosition`) lands the occluder in WORLD space
 * inside the depth map. Returns null (caller falls back to the legacy local-space
 * behavior) when there is nothing to bake or the device cannot allocate.
 */
function buildBakedCasterMatrices(input: {
  readonly device: RenderShadowFrameDeviceLike;
  readonly casterDrawList: ShadowCasterDrawListPlanReport;
  readonly matrices: DirectionalShadowMatrixComputationReport;
  readonly transforms: Float32Array;
}): BakedCasterMatrices | null {
  if (
    input.casterDrawList.status === "not-required" ||
    input.casterDrawList.includedDrawCount === 0
  ) {
    return null;
  }

  const lightVpByPass = new Map<string, readonly number[]>(
    input.matrices.matrices.map((matrix) => [
      matrix.passKey,
      matrix.viewProjectionMatrix,
    ]),
  );

  let entryCount = 0;
  for (const list of input.casterDrawList.lists) {
    if (lightVpByPass.has(list.passKey)) {
      entryCount += list.draws.length;
    }
  }

  if (entryCount === 0) {
    return null;
  }

  const data = new Float32Array(entryCount * BAKED_CASTER_MATRIX_FLOATS);
  const indexByPassDraw = new Map<string, number>();
  let entryIndex = 0;

  for (const list of input.casterDrawList.lists) {
    const lightVp = lightVpByPass.get(list.passKey);

    if (lightVp === undefined) {
      continue;
    }

    for (const draw of list.draws) {
      const world = readBakedCasterWorldMatrix(
        input.transforms,
        draw.worldTransformOffset,
      );
      // Caster shader computes matrices[i] * localPos; we need
      // lightVP * world * localPos, so bake lightVP * world. Operand order
      // matches multiplyMat4(projectionMatrix, viewMatrix) used elsewhere and
      // the receiver's directionalShadowMatrices[i] * worldPosition.
      const baked = multiplyMat4(lightVp as Mat4Like, world as Mat4Like);
      data.set(baked, entryIndex * BAKED_CASTER_MATRIX_FLOATS);
      indexByPassDraw.set(`${list.passKey}:${draw.renderId}`, entryIndex);
      entryIndex += 1;
    }
  }

  const resourceKey = "shadow-caster-baked-matrix-buffer:directional";
  const buffer = createWebGpuBuffer({
    device: input.device,
    descriptor: {
      label: "DirectionalShadowCasterBakedMatrices/storage",
      size: data.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: data,
    },
  });

  if (!buffer.ok) {
    return null;
  }

  return { buffer: buffer.buffer, resourceKey, indexByPassDraw };
}

function readBakedCasterWorldMatrix(
  transforms: Float32Array,
  offset: number,
): Float32Array {
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset + BAKED_CASTER_MATRIX_FLOATS > transforms.length
  ) {
    return BAKED_CASTER_IDENTITY;
  }

  return transforms.subarray(offset, offset + BAKED_CASTER_MATRIX_FLOATS);
}

function createBakedCasterBindGroup(
  device: RenderShadowFrameDeviceLike,
  baked: BakedCasterMatrices | null,
  layout: unknown,
): {
  readonly matrixResourceKey: string;
  readonly resourceKey: string;
  readonly group: number;
  readonly bindGroup: unknown;
} | null {
  if (baked === null || device.createBindGroup === undefined) {
    return null;
  }

  const resolvedLayout =
    layout ??
    device.createBindGroupLayout?.(
      createShadowCasterMatrixBindGroupLayoutDescriptor(),
    );

  if (resolvedLayout === undefined || resolvedLayout === null) {
    return null;
  }

  const resourceKey = `bind-group:shadow-caster/baked-matrices/${baked.resourceKey}`;
  const bindGroup = device.createBindGroup({
    label: resourceKey,
    layout: resolvedLayout,
    entries: [{ binding: 0, resource: { buffer: baked.buffer } }],
  });

  return {
    matrixResourceKey: baked.resourceKey,
    resourceKey,
    group: 0,
    bindGroup,
  };
}

interface PrimaryShadowCamera {
  readonly viewMatrix: Mat4Like;
  readonly projectionMatrix: Mat4Like;
  readonly near: number;
  readonly far: number;
}

function resolvePrimaryShadowCamera(
  snapshot: RenderSnapshot,
): PrimaryShadowCamera | null {
  const view = selectPrimaryShadowView(snapshot);

  if (view === undefined) {
    return null;
  }

  const viewMatrix = readSnapshotMatrix(
    snapshot.viewMatrices,
    view.viewMatrixOffset,
  );
  const projectionMatrix = readSnapshotMatrix(
    snapshot.viewMatrices,
    view.projectionMatrixOffset,
  );

  if (viewMatrix === null || projectionMatrix === null) {
    return null;
  }

  const range = cameraDepthRange(viewMatrix, projectionMatrix);

  if (range === null) {
    return null;
  }

  return {
    viewMatrix,
    projectionMatrix,
    near: range.near,
    far: range.far,
  };
}

function selectPrimaryShadowView(
  snapshot: RenderSnapshot,
): RenderSnapshot["views"][number] | undefined {
  return (
    snapshot.views.find((view) => view.renderTarget === null) ??
    snapshot.views[0]
  );
}

function readSnapshotMatrix(
  values: Float32Array,
  offset: number,
): Mat4Like | null {
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset + MATRIX_FLOAT_COUNT > values.length
  ) {
    return null;
  }

  return values.subarray(offset, offset + MATRIX_FLOAT_COUNT);
}

function cameraDepthRange(
  viewMatrix: Mat4Like,
  projectionMatrix: Mat4Like,
): { readonly near: number; readonly far: number } | null {
  const inverseViewProjection = invertMat4(
    multiplyMat4(projectionMatrix, viewMatrix),
  );
  const inverseView = invertMat4(viewMatrix);

  if (inverseViewProjection === null || inverseView === null) {
    return null;
  }

  const cameraPosition: readonly [number, number, number] = [
    inverseView[12] ?? 0,
    inverseView[13] ?? 0,
    inverseView[14] ?? 0,
  ];
  const forward = normalizeTuple3([
    -(inverseView[8] ?? 0),
    -(inverseView[9] ?? 0),
    -(inverseView[10] ?? 0),
  ]);

  if (forward === null) {
    return null;
  }

  const nearCenter = tuple3(transformPoint(inverseViewProjection, [0, 0, 0]));
  const farCenter = tuple3(transformPoint(inverseViewProjection, [0, 0, 1]));
  const near = dotTuple3(forward, subTuple3(nearCenter, cameraPosition));
  const far = dotTuple3(forward, subTuple3(farCenter, cameraPosition));

  if (!(near > 0) || !(far > near + EPSILON)) {
    return null;
  }

  return { near, far };
}

function tuple3(value: readonly number[]): readonly [number, number, number] {
  return [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0];
}

function normalizeTuple3(
  value: readonly [number, number, number],
): readonly [number, number, number] | null {
  const length = Math.hypot(value[0], value[1], value[2]);

  if (length <= EPSILON) {
    return null;
  }

  return [value[0] / length, value[1] / length, value[2] / length];
}

function dotTuple3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function subTuple3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): readonly [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function createDirectionalShadowDescriptor(
  request: ShadowRequestPacket,
  options: RenderShadowFrameShadowMapOptions | undefined,
): ShadowMapDescriptorSource {
  const cascadeCount = Math.max(
    1,
    Math.min(4, Math.round(options?.cascadeCount ?? request.cascadeCount ?? 1)),
  );
  const resourceKey =
    options?.resourceKey ??
    (cascadeCount > 1
      ? `shadow-map:${request.shadowId}:light:${request.lightId}:csm`
      : `shadow-map:${request.shadowId}:light:${request.lightId}`);

  return {
    shadowId: request.shadowId,
    lightId: request.lightId,
    // Honor the authored shadow-map resolution (three.js LightShadow.mapSize /
    // PlayCanvas light._shadowResolution parity); only fall back to the engine
    // default when neither an explicit option nor an authored value is present.
    mapSize: options?.mapSize ?? request.mapSize ?? DEFAULT_SHADOW_MAP_SIZE,
    depthBias: options?.depthBias ?? request.depthBias ?? DEFAULT_DEPTH_BIAS,
    normalBias: options?.normalBias ?? request.normalBias ?? 0,
    filterRadiusTexels:
      options?.filterRadiusTexels ?? request.filterRadius ?? 1,
    cascadeCount,
    viewDimension: cascadeCount > 1 ? "2d-array" : "2d",
    resourceKey,
  };
}

function maxAuthoredCasterSlopeBias(
  shadowRequests: readonly ShadowRequestPacket[],
): { readonly slopeBias: number } | Record<string, never> {
  let slopeBias = 0;

  for (const request of shadowRequests) {
    slopeBias = Math.max(slopeBias, request.slopeBias ?? 0);
  }

  return slopeBias > 0 ? { slopeBias } : {};
}

function createReceiverResources(input: {
  readonly shadowKind: RenderShadowFrameShadowKind;
  readonly matrixBufferResource: ShadowMatrixBufferResourceReport;
  readonly depthTextureResources: ShadowDepthTextureResourceReport;
  readonly samplerResource: ReturnType<
    typeof createShadowSamplerResourceReport
  >;
}): StandardFrameShadowReceiverResources | null {
  if (
    input.matrixBufferResource.resource === null ||
    input.samplerResource.resource === null ||
    !input.depthTextureResources.resources.some(
      (resource) => resource.allocation.resource !== null,
    )
  ) {
    return null;
  }

  return {
    shadowKind: input.shadowKind,
    matrixBufferResource: input.matrixBufferResource,
    depthTextureResources: input.depthTextureResources,
    samplerResource: input.samplerResource,
  };
}

function createRenderShadowFrameReport(input: {
  readonly shadowKind: RenderShadowFrameShadowKind | null;
  readonly shadowRequests: readonly ShadowRequestPacket[];
  readonly depthTextureResources: ShadowDepthTextureResourceReport;
  readonly matrixBufferResource: ShadowMatrixBufferResourceReport;
  readonly samplerResource: ReturnType<
    typeof createShadowSamplerResourceReport
  >;
  readonly pipelineResource: ShadowCasterPipelineResourceReport;
  readonly matrixBindGroupResource: ShadowCasterMatrixBindGroupResourceReport;
  readonly commandBufferSubmission: ShadowPassCommandBufferSubmissionReport;
  readonly receiverResources: StandardFrameShadowReceiverResources | null;
  readonly stages: RenderShadowFrameDiagnosticStages;
}): RenderShadowFrameReport {
  const diagnostics = collectRenderShadowFrameDiagnostics(input.stages);
  const submitted = input.commandBufferSubmission.status === "submitted";
  const ready =
    input.receiverResources !== null && input.commandBufferSubmission.ready;
  const status =
    input.shadowRequests.length === 0
      ? "not-required"
      : submitted
        ? "submitted"
        : ready
          ? "ready"
          : "missing";

  return {
    ready:
      status === "submitted" || status === "ready" || status === "not-required",
    status,
    shadowKind: input.shadowKind,
    requestCount: input.shadowRequests.length,
    passCount: input.commandBufferSubmission.counts.assembledPasses,
    drawCalls: input.commandBufferSubmission.counts.drawCalls,
    depthTextureKeys: input.depthTextureResources.resources.map(
      (resource) => resource.textureKey,
    ),
    matrixBufferResourceKey:
      input.matrixBufferResource.resource?.resourceKey ?? null,
    sections: {
      shadowRequests: input.shadowRequests.length > 0,
      depthTextureResources: input.depthTextureResources.ready,
      matrixBufferResource: input.matrixBufferResource.ready,
      samplerResource: input.samplerResource.ready,
      pipelineResource: input.pipelineResource.ready,
      matrixBindGroupResource: input.matrixBindGroupResource.ready,
      commandBufferSubmission:
        input.commandBufferSubmission.status === "submitted",
      receiverResources: input.receiverResources !== null,
    },
    resourceReuse: {
      depthTexturesCreated: input.depthTextureResources.createdTextureCount,
      depthTexturesReused: input.depthTextureResources.reusedTextureCount,
      matrixBuffersCreated: input.matrixBufferResource.createdBufferCount,
      matrixBuffersReused: input.matrixBufferResource.reusedBufferCount,
      samplersCreated: input.samplerResource.createdSamplerCount,
      samplersReused: input.samplerResource.reusedSamplerCount,
      pipelinesCreated: input.pipelineResource.createdPipelineCount,
      pipelinesReused: input.pipelineResource.reusedPipelineCount,
      matrixBindGroupsCreated:
        input.matrixBindGroupResource.createdBindGroupCount,
      matrixBindGroupsReused:
        input.matrixBindGroupResource.reusedBindGroupCount,
    },
    commandBufferSubmission: {
      status: input.commandBufferSubmission.status,
      assembledPasses: input.commandBufferSubmission.counts.assembledPasses,
      commandBuffers: input.commandBufferSubmission.counts.commandBuffers,
      submittedCommandBuffers:
        input.commandBufferSubmission.counts.submittedCommandBuffers,
      commandBufferKeys: [...input.commandBufferSubmission.commandBufferKeys],
      sections: { ...input.commandBufferSubmission.sections },
    },
    diagnostics,
  };
}

interface RenderShadowFrameDiagnosticStages {
  readonly descriptor: ShadowMapDescriptorReport;
  readonly textures: ShadowTextureResourceReport;
  readonly depthTextureResources: ShadowDepthTextureResourceReport;
  readonly samplerResource: ReturnType<
    typeof createShadowSamplerResourceReport
  >;
  readonly passPlan: ShadowPassPlanReport;
  readonly passAttachments: ShadowPassAttachmentDescriptorReport;
  readonly viewProjection: DirectionalShadowViewProjectionPlanReport;
  readonly matrixComputation: DirectionalShadowMatrixComputationReport;
  readonly matrixBuffer: ShadowMatrixBufferDescriptorReport;
  readonly matrixBufferResource: ShadowMatrixBufferResourceReport;
  readonly casterDrawList: ShadowCasterDrawListPlanReport;
  readonly commandPlan: ShadowCasterCommandPlanReadinessReport;
  readonly commandEncoding: ShadowPassCommandEncodingReport;
  readonly pipelineDescriptor: ShadowCasterPipelineDescriptorReport;
  readonly pipelineResource: ShadowCasterPipelineResourceReport;
  readonly matrixBindGroupResource: ShadowCasterMatrixBindGroupResourceReport;
  readonly frameResources: ShadowCasterFrameResourceReadinessReport;
  readonly commandRecords: ShadowCasterCommandRecordPlanReport;
  readonly encoderAssembly: ShadowPassEncoderAssemblyReport;
  readonly commandBufferSubmission: ShadowPassCommandBufferSubmissionReport;
}

function collectRenderShadowFrameDiagnostics(
  stages: RenderShadowFrameDiagnosticStages,
): readonly RenderShadowFrameDiagnostic[] {
  const diagnostics: RenderShadowFrameDiagnostic[] = [];
  const append = (stage: string, values: readonly unknown[]) => {
    for (const value of values) {
      const diagnostic = normalizeDiagnostic(stage, value);

      if (diagnostic !== null && !isLegacyDeferredDiagnostic(diagnostic)) {
        diagnostics.push(diagnostic);
      }
    }
  };

  append(
    "descriptor",
    shadowMapDescriptorReportToJsonValue(stages.descriptor).diagnostics,
  );
  append(
    "textures",
    shadowTextureResourceReportToJsonValue(stages.textures).diagnostics,
  );
  append(
    "depthTextureResources",
    shadowDepthTextureResourceReportToJsonValue(stages.depthTextureResources)
      .diagnostics,
  );
  append("samplerResource", stages.samplerResource.diagnostics);
  append(
    "passPlan",
    shadowPassPlanReportToJsonValue(stages.passPlan).diagnostics,
  );
  append(
    "passAttachments",
    shadowPassAttachmentDescriptorReportToJsonValue(stages.passAttachments)
      .diagnostics,
  );
  append(
    "viewProjection",
    directionalShadowViewProjectionPlanReportToJsonValue(stages.viewProjection)
      .diagnostics,
  );
  append(
    "matrixComputation",
    directionalShadowMatrixComputationReportToJsonValue(
      stages.matrixComputation,
    ).diagnostics,
  );
  append(
    "matrixBuffer",
    shadowMatrixBufferDescriptorReportToJsonValue(stages.matrixBuffer)
      .diagnostics,
  );
  append("matrixBufferResource", stages.matrixBufferResource.diagnostics);
  append(
    "casterDrawList",
    shadowCasterDrawListPlanReportToJsonValue(stages.casterDrawList)
      .diagnostics,
  );
  append(
    "commandPlan",
    shadowCasterCommandPlanReadinessReportToJsonValue(stages.commandPlan)
      .diagnostics,
  );
  append(
    "commandEncoding",
    shadowPassCommandEncodingReportToJsonValue(stages.commandEncoding)
      .diagnostics,
  );
  append(
    "pipelineDescriptor",
    shadowCasterPipelineDescriptorReportToJsonValue(stages.pipelineDescriptor)
      .diagnostics,
  );
  append("pipelineResource", stages.pipelineResource.diagnostics);
  append("matrixBindGroupResource", stages.matrixBindGroupResource.diagnostics);
  append(
    "frameResources",
    shadowCasterFrameResourceReadinessReportToJsonValue(stages.frameResources)
      .diagnostics,
  );
  append(
    "commandRecords",
    shadowCasterCommandRecordPlanReportToJsonValue(stages.commandRecords)
      .diagnostics,
  );
  append(
    "encoderAssembly",
    shadowPassEncoderAssemblyReportToJsonValue(stages.encoderAssembly)
      .diagnostics,
  );
  append(
    "commandBufferSubmission",
    shadowPassCommandBufferSubmissionReportToJsonValue(
      stages.commandBufferSubmission,
    ).diagnostics,
  );

  return diagnostics;
}

function normalizeDiagnostic(
  stage: string,
  value: unknown,
): RenderShadowFrameDiagnostic | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as {
    readonly code?: unknown;
    readonly severity?: unknown;
    readonly message?: unknown;
  };

  if (typeof record.code !== "string" || typeof record.message !== "string") {
    return null;
  }

  return {
    stage,
    code: record.code,
    severity: record.severity === "error" ? "error" : "warning",
    message: record.message,
  };
}

function isLegacyDeferredDiagnostic(
  diagnostic: RenderShadowFrameDiagnostic,
): boolean {
  return (
    diagnostic.code.endsWith("Deferred") ||
    diagnostic.message.includes("deferred") ||
    diagnostic.message.includes("not implemented yet")
  );
}

function resolveShadowKind(
  descriptor: ShadowMapDescriptorReport,
): RenderShadowFrameShadowKind {
  return descriptor.descriptors.some((entry) => entry.cascadeCount > 1)
    ? "directional-cascaded"
    : "directional";
}

function isDirectionalShadowRequest(request: ShadowRequestPacket): boolean {
  return request.lightKind === undefined || request.lightKind === "directional";
}
