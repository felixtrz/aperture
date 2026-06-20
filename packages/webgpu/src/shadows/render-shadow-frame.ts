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
import {
  createWebGpuBuffer,
  destroyWebGpuBuffer,
  writeWebGpuBufferData,
  writeWebGpuBufferSubData,
} from "../gpu/buffer.js";
import type { WebGpuBufferDeviceLike } from "../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../resources/meshes/mesh-buffer-descriptors.js";
import type { CommandEncoderFinishLike } from "../gpu/command-buffer.js";
import {
  createCommandEncoderResource,
  type CommandEncoderDeviceLike,
} from "../gpu/command-encoder.js";
import type { GpuTimestampQueryResources } from "../gpu/gpu-timing.js";
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
  type DirectionalShadowReceiverBoundsInput,
} from "./directional-shadow-matrix-computation.js";
import {
  createDirectionalShadowViewProjectionPlanReport,
  directionalShadowViewProjectionPlanReportToJsonValue,
  type DirectionalShadowViewProjectionPlanReport,
} from "./directional-shadow-view-projection-plan.js";
import {
  createPointShadowViewProjectionPlanReport,
  pointShadowViewProjectionPlanReportToJsonValue,
  type PointShadowViewProjectionPlanReport,
} from "./point-shadow-view-projection-plan.js";
import {
  createPointShadowMatrixComputationReport,
  pointShadowMatrixComputationReportToJsonValue,
  type PointShadowMatrixComputationReport,
} from "./point-shadow-matrix-computation.js";
import {
  createSpotShadowViewProjectionPlanReport,
  spotShadowViewProjectionPlanReportToJsonValue,
  type SpotShadowViewProjectionPlanReport,
} from "./spot-shadow-view-projection-plan.js";
import {
  createSpotShadowMatrixComputationReport,
  spotShadowMatrixComputationReportToJsonValue,
  type SpotShadowMatrixComputationReport,
} from "./spot-shadow-matrix-computation.js";
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
  shadowCasterMatrixBindGroupResourceKey,
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

/**
 * Which light kind a frame bakes. A frame bakes exactly one (directional takes
 * precedence, then point, then spot — see createRenderShadowFrame). Drives the
 * per-kind view-projection/matrix serializers in the report.
 */
export type RenderShadowFrameKind = "directional" | "point" | "spot";

/**
 * The shadow view-projection / matrix-computation reports differ by light kind
 * (directional cascades vs point cube faces vs spot perspective) but flow
 * through the same generic caster pipeline. The frame result and report widen to
 * the union so a frame can be any kind without losing per-kind diagnostics.
 */
export type RenderShadowFrameViewProjectionReport =
  | DirectionalShadowViewProjectionPlanReport
  | PointShadowViewProjectionPlanReport
  | SpotShadowViewProjectionPlanReport;
export type RenderShadowFrameMatrixComputationReport =
  | DirectionalShadowMatrixComputationReport
  | PointShadowMatrixComputationReport
  | SpotShadowMatrixComputationReport;

export interface RenderShadowFrameCache {
  readonly shadowDepthTextures?: ShadowDepthTextureResourceCache;
  readonly shadowMatrixBuffers?: Map<string, ShadowMatrixBufferResource>;
  readonly shadowSamplers?: Map<string, ShadowSamplerResource>;
  readonly shadowCasterPipelines?: Map<string, ShadowCasterPipelineResource>;
  readonly shadowCasterMatrixBindGroups?: Map<
    string,
    ShadowCasterMatrixBindGroupResource
  >;
  readonly shadowCasterPassMatrixBuffers?: Map<
    string,
    ShadowCasterPassMatrixBufferResource
  >;
  readonly shadowCasterWorldTransformBuffers?: Map<
    string,
    ShadowCasterWorldTransformBufferResource
  >;
  readonly shadowCasterWorldTransformScratch?: ShadowCasterWorldTransformScratch;
  readonly shadowCasterCommandTopology?: Map<
    string,
    ShadowCasterCommandTopologyCacheEntry
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
  /** Fallback center used when no primary render camera can drive auto-fit. */
  readonly center?: readonly [number, number, number];
  /** Fallback span used when no primary render camera can drive auto-fit. */
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
  readonly encode?: boolean;
  readonly submit?: boolean;
  readonly gpuTiming?: {
    readonly resources: GpuTimestampQueryResources;
  };
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
  readonly viewProjection: RenderShadowFrameViewProjectionReport;
  readonly matrixComputation: RenderShadowFrameMatrixComputationReport;
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
  readonly descriptor: ShadowMapDescriptorReport;
  readonly viewProjection: RenderShadowFrameViewProjectionReport;
  readonly matrixComputation: RenderShadowFrameMatrixComputationReport;
  readonly casterDrawList: ShadowCasterDrawListPlanReport;
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

export interface ShadowCasterPassMatrixBufferResource {
  readonly resourceKey: string;
  readonly matrixResourceKey: string;
  readonly label: string;
  readonly passKey: string;
  readonly matrixKey: string;
  readonly buffer: unknown;
  readonly byteSize: number;
  readonly lastData: Float32Array;
}

export interface ShadowCasterWorldTransformBufferResource {
  readonly resourceKey: string;
  readonly label: string;
  readonly buffer: unknown;
  readonly byteSize: number;
  readonly matrixCount: number;
  readonly lastData: Float32Array;
}

export interface ShadowCasterWorldTransformScratch {
  data: Float32Array;
  readonly indexByPassDraw: Map<string, number>;
}

export interface ShadowCasterCommandTopologyCacheEntry {
  readonly key: string;
  readonly frameResources: ShadowCasterFrameResourceReadinessReport;
  readonly commandRecords: ShadowCasterCommandRecordPlanReport;
}

const DEFAULT_SHADOW_MAP_SIZE = 1024;
const DEFAULT_DEPTH_BIAS = 0.001;
const MATRIX_FLOAT_COUNT = 16;
const EPSILON = 1e-6;

export function createShadowCasterWorldTransformScratch(): ShadowCasterWorldTransformScratch {
  return {
    data: new Float32Array(0),
    indexByPassDraw: new Map(),
  };
}

export function createRenderShadowFrame(
  options: CreateRenderShadowFrameOptions,
): RenderShadowFrameResult {
  const encodeCommandBuffer = options.encode !== false;
  // A frame bakes a single light kind. Directional takes precedence, then point,
  // then spot — each is the sole shadow kind in its frame. Mixing kinds in one
  // frame is a follow-up (the multi receiver bind group needs combined point +
  // spot resources). Point bakes a 2d-array cube; spot a single 2D perspective
  // map that reuses the directional bindings.
  const directionalRequests = options.snapshot.shadowRequests.filter(
    isDirectionalShadowRequest,
  );
  const pointShadowRequests =
    options.snapshot.shadowRequests.filter(isPointShadowRequest);
  const spotShadowRequests =
    options.snapshot.shadowRequests.filter(isSpotShadowRequest);
  const isPointFrame =
    directionalRequests.length === 0 && pointShadowRequests.length > 0;
  const isSpotFrame =
    directionalRequests.length === 0 &&
    pointShadowRequests.length === 0 &&
    spotShadowRequests.length > 0;
  const shadowRequests = isPointFrame
    ? pointShadowRequests
    : isSpotFrame
      ? spotShadowRequests
      : directionalRequests;
  const kindLabel = isPointFrame
    ? "point"
    : isSpotFrame
      ? "spot"
      : "directional";
  const descriptor = createShadowMapDescriptorReport({
    shadowRequests,
    descriptors: shadowRequests.map((request) =>
      isPointFrame
        ? createPointShadowDescriptor(request, options.shadowMap)
        : isSpotFrame
          ? createSpotShadowDescriptor(request, options.shadowMap)
          : createDirectionalShadowDescriptor(request, options.shadowMap),
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
    resourceKey: `shadow-sampler:${kindLabel}`,
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
  const casterDrawList = createShadowCasterDrawListPlanReport({
    shadowRequests,
    meshDraws: options.snapshot.shadowCasterDraws ?? options.snapshot.meshDraws,
    shadowPassPlan: passPlan,
    commandEncoding: "ready",
  });
  // A frame bakes exactly one light kind (see isPointFrame). Point shadows use a
  // fixed perspective cube projection derived from the light range and so skip
  // the directional camera-frustum auto-fit; both kinds resolve a view-projection
  // and matrix computation here, then flow through the same generic caster
  // pipeline below.
  let viewProjection: RenderShadowFrameViewProjectionReport;
  let matrixComputation: RenderShadowFrameMatrixComputationReport;
  if (isPointFrame) {
    const pointViewProjection = createPointShadowViewProjectionPlanReport({
      shadowRequests,
      lights: options.snapshot.lights,
      shadowPassPlan: passPlan,
      computation: "ready",
    });
    viewProjection = pointViewProjection;
    matrixComputation = createPointShadowMatrixComputationReport({
      viewProjection: pointViewProjection,
      transforms: options.snapshot.transforms,
    });
  } else if (isSpotFrame) {
    // Spot shadows use a single 2D perspective map (three.js SpotLightShadow):
    // a PerspectiveCamera looking down the cone axis. The fixed near/far come
    // from the light range, so — like point — it skips the directional
    // camera-frustum auto-fit and resolves a self-contained view-projection.
    const spotViewProjection = createSpotShadowViewProjectionPlanReport({
      shadowRequests,
      lights: options.snapshot.lights,
      shadowPassPlan: passPlan,
      computation: "ready",
    });
    viewProjection = spotViewProjection;
    matrixComputation = createSpotShadowMatrixComputationReport({
      viewProjection: spotViewProjection,
      transforms: options.snapshot.transforms,
    });
  } else {
    const shadowCamera = resolvePrimaryShadowCamera(options.snapshot);
    const needsCameraFrustumFit =
      shadowCamera !== null &&
      shadowRequests.some(shadowRequestNeedsCameraFrustumFit);
    const fallbackMatrix = needsCameraFrustumFit ? undefined : options.matrix;
    const directionalViewProjection =
      createDirectionalShadowViewProjectionPlanReport({
        shadowRequests,
        lights: options.snapshot.lights,
        shadowPassPlan: passPlan,
        computation: "ready",
        ...(!needsCameraFrustumFit || shadowCamera === null
          ? {}
          : {
              cameraNear: shadowCamera.near,
              cameraFar: shadowCamera.far,
              shadowMaxDistance: shadowCamera.far,
            }),
      });
    viewProjection = directionalViewProjection;
    matrixComputation = createDirectionalShadowMatrixComputationReport({
      viewProjection: directionalViewProjection,
      transforms: options.snapshot.transforms,
      ...(!needsCameraFrustumFit || shadowCamera === null
        ? {}
        : {
            cameraViewMatrix: shadowCamera.viewMatrix,
            cameraProjectionMatrix: shadowCamera.projectionMatrix,
          }),
      ...(needsCameraFrustumFit
        ? {
            casterBounds: createDirectionalShadowCasterBounds({
              casterDrawList,
              bounds: options.snapshot.bounds,
            }),
            receiverBounds: createDirectionalShadowReceiverBounds({
              passPlan,
              meshDraws: options.snapshot.meshDraws,
              bounds: options.snapshot.bounds,
            }),
          }
        : {}),
      frustumFit: needsCameraFrustumFit,
      ...(fallbackMatrix?.center === undefined
        ? {}
        : { center: fallbackMatrix.center }),
      ...(fallbackMatrix?.orthographicSize === undefined
        ? {}
        : { orthographicSize: fallbackMatrix.orthographicSize }),
      ...(fallbackMatrix?.near === undefined
        ? {}
        : { near: fallbackMatrix.near }),
      ...(fallbackMatrix?.far === undefined ? {} : { far: fallbackMatrix.far }),
      ...(fallbackMatrix?.lightDistance === undefined
        ? {}
        : { lightDistance: fallbackMatrix.lightDistance }),
    });
  }
  const matrixBuffer = createShadowMatrixBufferDescriptorReport({
    viewProjection,
    upload: "ready",
    resourceKey: `shadow-matrix-buffer:${kindLabel}`,
    // Spot shadows reuse the directional bindings (sampleDirectionalShadowFactor
    // samples matrix 0), so they upload into the directional matrix storage.
    label: isPointFrame
      ? "PointShadowMatrices/storage"
      : "DirectionalShadowMatrices/storage",
  });
  const matrixBufferResource = createShadowMatrixBufferResourceReport({
    device: options.device,
    descriptor: matrixBuffer,
    matrices: matrixComputation,
    ...(options.cache?.shadowMatrixBuffers === undefined
      ? {}
      : { cache: options.cache.shadowMatrixBuffers }),
  });
  if (matrixBufferResource.createdBufferCount > 0) {
    invalidateShadowCasterMatrixBindGroup(
      options.cache?.shadowCasterMatrixBindGroups,
      matrixBufferResource.resource?.resourceKey,
    );
  }
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
  const casterPassMatrices = createShadowCasterPassMatrixBuffers({
    device: options.device,
    matrices: matrixComputation,
    ...(options.cache?.shadowCasterPassMatrixBuffers === undefined
      ? {}
      : { cache: options.cache.shadowCasterPassMatrixBuffers }),
  });
  const casterWorldTransforms = buildShadowCasterWorldTransforms({
    device: options.device,
    casterDrawList,
    transforms: options.snapshot.transforms,
    ...(options.cache?.shadowCasterWorldTransformBuffers === undefined
      ? {}
      : { cache: options.cache.shadowCasterWorldTransformBuffers }),
    ...(options.cache?.shadowCasterMatrixBindGroups === undefined
      ? {}
      : { bindGroupCache: options.cache.shadowCasterMatrixBindGroups }),
    ...(options.cache?.shadowCasterWorldTransformScratch === undefined
      ? {}
      : { scratch: options.cache.shadowCasterWorldTransformScratch }),
  });
  // A recreated world-transform buffer leaves every cached command topology
  // pointing at the destroyed buffer (their bind groups embed it under a stable
  // resourceKey). Drop them so a later frame that revisits a prior caster
  // configuration rebuilds its records against the live buffer instead of
  // replaying one that submits a destroyed buffer (a permanent black frame).
  if (casterWorldTransforms?.recreated === true) {
    options.cache?.shadowCasterCommandTopology?.clear();
  }
  const matrixBindGroupResource =
    createShadowCasterMatrixBindGroupResourceReport({
      device: options.device,
      matrixBufferResource,
      passMatrixResources: casterPassMatrices,
      worldTransformResource:
        casterWorldTransforms === null
          ? null
          : {
              resourceKey: casterWorldTransforms.resourceKey,
              buffer: casterWorldTransforms.buffer,
            },
      ...(pipelineResource.resource?.matrixBindGroupLayout === undefined
        ? {}
        : { layout: pipelineResource.resource.matrixBindGroupLayout }),
      ...(options.cache?.shadowCasterMatrixBindGroups === undefined
        ? {}
        : { cache: options.cache.shadowCasterMatrixBindGroups }),
    });
  const shadowCasterCommandTopologyKey =
    createShadowCasterCommandTopologyCacheKey({
      casterDrawList,
      commandPlan,
      preparedMeshes: options.preparedMeshes,
      executableMeshes: options.executableMeshes,
      matrixBufferResource,
      pipelineResource,
      matrixBindGroupResource,
    });
  const cachedShadowCasterCommandTopology =
    shadowCasterCommandTopologyKey === null
      ? undefined
      : options.cache?.shadowCasterCommandTopology?.get(
          shadowCasterCommandTopologyKey,
        );
  const frameResources =
    cachedShadowCasterCommandTopology?.frameResources ??
    createShadowCasterFrameResourceReadinessReport({
      casterDrawList,
      preparedMeshes: options.preparedMeshes,
      matrixBufferResource,
      pipelineDescriptor,
    });

  const commandRecords =
    cachedShadowCasterCommandTopology?.commandRecords ??
    createShadowCasterCommandRecordPlanReport({
      frameResources,
      commandPlan,
      pipelines: pipelineResource.resources.map((resource) => ({
        pipelineKey: resource.pipelineKey,
        resourceKey: resource.resourceKey,
        pipeline: resource.pipeline,
      })),
      matrixBindGroups:
        matrixBindGroupResource.resources.length > 0
          ? matrixBindGroupResource.resources.map((resource) => ({
              matrixResourceKey: resource.matrixResourceKey,
              ...(resource.passKey === undefined
                ? {}
                : { passKey: resource.passKey }),
              ...(resource.worldTransformResourceKey === undefined
                ? {}
                : {
                    worldTransformResourceKey:
                      resource.worldTransformResourceKey,
                  }),
              resourceKey: resource.resourceKey,
              group: resource.group,
              bindGroup: resource.bindGroup,
            }))
          : matrixBindGroupResource.resource === null
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
      ...(casterWorldTransforms === null ||
      cachedShadowCasterCommandTopology !== undefined
        ? {}
        : {
            worldTransformIndexByPassDraw: buildShadowCasterWorldTransformIndex(
              {
                casterDrawList,
                ...(options.cache?.shadowCasterWorldTransformScratch ===
                undefined
                  ? {}
                  : {
                      scratch: options.cache.shadowCasterWorldTransformScratch,
                    }),
              },
            ),
          }),
    });
  if (
    cachedShadowCasterCommandTopology === undefined &&
    shadowCasterCommandTopologyKey !== null &&
    frameResources.status === "ready" &&
    commandRecords.status === "ready"
  ) {
    options.cache?.shadowCasterCommandTopology?.set(
      shadowCasterCommandTopologyKey,
      {
        key: shadowCasterCommandTopologyKey,
        frameResources,
        commandRecords,
      },
    );
  }
  const encoderResource = encodeCommandBuffer
    ? createCommandEncoderResource({
        device: options.device,
        label: options.label ?? `shadow-pass:${kindLabel}`,
      })
    : null;
  const encoder = encoderResource?.resource?.encoder as
    | (RenderPassCommandEncoderLike & CommandEncoderFinishLike)
    | undefined;
  const encoderAssembly = createShadowPassEncoderAssemblyReport({
    attachments: passAttachments,
    frameResources,
    commandEncoding,
    commands: commandRecords.commandRecords,
    ...(encoder === undefined ? {} : { encoder }),
    ...(options.gpuTiming === undefined
      ? {}
      : { gpuTiming: { resources: options.gpuTiming.resources } }),
    deferEncoding: !encodeCommandBuffer,
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
      label: options.label ?? `shadow-pass:${kindLabel}`,
      submit: options.submit ?? true,
      deferEncoding: !encodeCommandBuffer,
      ...(options.gpuTiming === undefined
        ? {}
        : {
            gpuTiming: {
              resources: options.gpuTiming.resources,
              queryCount: passPlan.passCount * 2,
            },
          }),
    },
  );
  const receiverResources = createReceiverResources({
    // Point shadows use the 2d-array ("point-array") receiver path: each cube
    // face is an array layer reprojected through its own matrix in the shader,
    // which keeps occluder placement self-consistent with the bake. The
    // pipeline-kind (auto-shadow-frame) must agree so the variant + bindings
    // select the 2d-array sampler.
    //
    // Spot shadows ("spot") reuse the directional single-2D bindings (same
    // bind-group layout: matrix@2, depth@3, sampler@4) — the only difference is
    // the shader's spotShadowMap feature, which also shadows the spot light
    // block via sampleDirectionalShadowFactor (matrix 0). So the receiver
    // resources match the directional shape; only the kind label differs.
    shadowKind: isPointFrame
      ? "point-array"
      : isSpotFrame
        ? "spot"
        : resolveShadowKind(descriptor),
    matrixBufferResource,
    depthTextureResources,
    samplerResource,
  });
  const report = createRenderShadowFrameReport({
    shadowKind: receiverResources?.shadowKind ?? null,
    kind: kindLabel,
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

function createShadowCasterCommandTopologyCacheKey(input: {
  readonly casterDrawList: ShadowCasterDrawListPlanReport;
  readonly commandPlan: ShadowCasterCommandPlanReadinessReport;
  readonly preparedMeshes: readonly ShadowCasterPreparedMeshResourceView[];
  readonly executableMeshes: readonly ShadowCasterExecutableMeshResourceView[];
  readonly matrixBufferResource: ShadowMatrixBufferResourceReport;
  readonly pipelineResource: ShadowCasterPipelineResourceReport;
  readonly matrixBindGroupResource: ShadowCasterMatrixBindGroupResourceReport;
}): string | null {
  if (
    input.casterDrawList.status === "not-required" ||
    input.casterDrawList.includedDrawCount === 0 ||
    input.commandPlan.status !== "ready" ||
    input.matrixBufferResource.resource === null ||
    input.pipelineResource.status !== "available" ||
    input.matrixBindGroupResource.status !== "available"
  ) {
    return null;
  }

  const parts = [
    "shadow-caster-command-topology:v1",
    `matrix:${input.matrixBufferResource.resource.resourceKey}`,
  ];

  for (const list of input.casterDrawList.lists) {
    parts.push(
      [
        "list",
        list.passKey,
        list.shadowId,
        list.lightId,
        list.casterLayerMask,
        list.receiverLayerMask,
        list.commandEncoding,
      ].join(":"),
    );

    for (const draw of list.draws) {
      parts.push(
        [
          "draw",
          draw.renderId,
          draw.meshKey,
          draw.materialKey,
          draw.meshLayoutKey,
          draw.casterCullMode,
          draw.submesh,
          draw.vertexStart ?? "default",
          draw.vertexCount ?? "default",
          draw.indexStart ?? "default",
          draw.indexCount ?? "default",
          draw.layerMask,
        ].join(":"),
      );
    }
  }

  for (const command of input.commandPlan.commands) {
    parts.push(
      [
        "command",
        command.commandKey,
        command.shadowId,
        command.lightId,
        command.passKey,
        command.matrixResourceKey,
        command.matrixOffsetBytes,
        command.drawCount,
        command.commandEncoding,
      ].join(":"),
    );
  }

  for (const mesh of [...input.preparedMeshes].sort(compareMeshResourceViews)) {
    parts.push(
      [
        "prepared-mesh",
        mesh.meshKey,
        mesh.meshResourceKey,
        mesh.indexBufferResourceKey ?? "none",
        ...mesh.vertexBufferResourceKeys,
      ].join(":"),
    );
  }

  for (const mesh of [...input.executableMeshes].sort(
    compareExecutableMeshResourceViews,
  )) {
    parts.push(
      [
        "executable-mesh",
        mesh.meshKey,
        mesh.meshResourceKey,
        mesh.indexBuffer?.resourceKey ?? "none",
        mesh.indexBuffer?.format ?? "none",
        mesh.indexBuffer?.indexCount ?? "none",
        ...mesh.vertexBuffers.flatMap((buffer) => [
          buffer.resourceKey,
          buffer.vertexCount,
        ]),
      ].join(":"),
    );
  }

  for (const resource of [...input.pipelineResource.resources].sort(
    comparePipelineResources,
  )) {
    parts.push(
      ["pipeline", resource.pipelineKey, resource.resourceKey].join(":"),
    );
  }

  const bindGroups =
    input.matrixBindGroupResource.resources.length > 0
      ? input.matrixBindGroupResource.resources
      : input.matrixBindGroupResource.resource === null
        ? []
        : [input.matrixBindGroupResource.resource];

  for (const resource of [...bindGroups].sort(
    compareMatrixBindGroupResources,
  )) {
    parts.push(
      [
        "matrix-bind-group",
        resource.passKey ?? "default",
        resource.matrixResourceKey,
        resource.worldTransformResourceKey ?? "none",
        resource.resourceKey,
      ].join(":"),
    );
  }

  return parts.join("\n");
}

function compareMeshResourceViews(
  a: ShadowCasterPreparedMeshResourceView,
  b: ShadowCasterPreparedMeshResourceView,
): number {
  return compareStrings(a.meshKey, b.meshKey);
}

function compareExecutableMeshResourceViews(
  a: ShadowCasterExecutableMeshResourceView,
  b: ShadowCasterExecutableMeshResourceView,
): number {
  return compareStrings(a.meshResourceKey, b.meshResourceKey);
}

function comparePipelineResources(
  a: ShadowCasterPipelineResource,
  b: ShadowCasterPipelineResource,
): number {
  return compareStrings(a.pipelineKey, b.pipelineKey);
}

function compareMatrixBindGroupResources(
  a: ShadowCasterMatrixBindGroupResource,
  b: ShadowCasterMatrixBindGroupResource,
): number {
  return compareStrings(a.resourceKey, b.resourceKey);
}

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
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

function createDirectionalShadowReceiverBounds(input: {
  readonly passPlan: ShadowPassPlanReport;
  readonly meshDraws: RenderSnapshot["meshDraws"];
  readonly bounds: readonly BoundsPacket[];
}): readonly DirectionalShadowReceiverBoundsInput[] {
  if (
    input.passPlan.status === "not-required" ||
    input.passPlan.passCount === 0
  ) {
    return [];
  }

  return input.passPlan.passes.map((pass) => ({
    passKey: pass.passKey,
    bounds: input.meshDraws.flatMap((draw) => {
      if (
        draw.receivesShadow === false ||
        !draw.batchKey.pipelineKey.startsWith("standard|") ||
        (draw.layerMask & pass.receiverLayerMask) === 0
      ) {
        return [];
      }

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

const SHADOW_CASTER_MATRIX_FLOATS = 16;
const SHADOW_CASTER_WORLD_DIRTY_FULL_WRITE_FRACTION = 0.5;
const SHADOW_CASTER_WORLD_DIRTY_MAX_RANGES = 64;
const SHADOW_CASTER_WORLD_DIRTY_MERGE_GAP_FLOATS = 256;
const SHADOW_CASTER_IDENTITY = new Float32Array([
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
]);

interface ShadowCasterWorldTransforms {
  readonly buffer: unknown;
  readonly resourceKey: string;
  /**
   * True when a brand-new GPU buffer was allocated this call (first creation or
   * a resize that destroyed the previous one). The shared caster world-transform
   * buffer is referenced by every cached `shadowCasterCommandTopology` entry's
   * bind groups, so when it is recreated those entries are stale and the caller
   * must drop them before reusing one.
   */
  readonly recreated: boolean;
}

/**
 * Builds one tiny pass-matrix buffer per shadow pass. The caster shader binds
 * exactly one of these per pass and multiplies it by the draw-list-order world
 * transform selected via firstInstance. This avoids rebaking every caster
 * matrix when the light/camera view-projection changes.
 */
function createShadowCasterPassMatrixBuffers(input: {
  readonly device: RenderShadowFrameDeviceLike;
  readonly matrices: RenderShadowFrameMatrixComputationReport;
  readonly cache?: Map<string, ShadowCasterPassMatrixBufferResource>;
}): readonly ShadowCasterPassMatrixBufferResource[] {
  if (input.matrices.status === "not-required") {
    return [];
  }

  const resources: ShadowCasterPassMatrixBufferResource[] = [];

  for (const matrix of input.matrices.matrices) {
    const data = new Float32Array(matrix.viewProjectionMatrix);
    const resourceKey = shadowCasterPassMatrixBufferResourceKey(
      matrix.passKey,
      matrix.matrixKey,
    );
    const cached = input.cache?.get(resourceKey);

    if (cached !== undefined) {
      if (cached.byteSize === data.byteLength) {
        if (!floatArraysEqual(cached.lastData, data)) {
          if (!writeWebGpuBufferData(input.device, cached.buffer, data)) {
            continue;
          }
          cached.lastData.set(data);
        }
        resources.push(cached);
        continue;
      }

      destroyWebGpuBuffer(cached.buffer);
      input.cache?.delete(resourceKey);
    }

    const label = `ShadowCasterPassMatrix/${matrix.passKey}`;
    const buffer = createWebGpuBuffer({
      device: input.device,
      descriptor: {
        label,
        size: data.byteLength,
        usage:
          WEBGPU_BUFFER_USAGE_FLAGS.UNIFORM |
          WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
        initialData: data,
      },
    });

    if (!buffer.ok) {
      continue;
    }

    const resource: ShadowCasterPassMatrixBufferResource = {
      resourceKey,
      matrixResourceKey: resourceKey,
      label,
      passKey: matrix.passKey,
      matrixKey: matrix.matrixKey,
      buffer: buffer.buffer,
      byteSize: data.byteLength,
      lastData: new Float32Array(data),
    };

    input.cache?.set(resourceKey, resource);
    resources.push(resource);
  }

  return resources;
}

/**
 * Builds a caster-only WORLD matrix buffer in shadow draw-list order. This is
 * the shadow equivalent of draw-order transform packing: compatible sorted
 * caster records get contiguous firstInstance slots, while light/camera matrix
 * changes do not dirty the whole caster table.
 */
function buildShadowCasterWorldTransforms(input: {
  readonly device: RenderShadowFrameDeviceLike;
  readonly casterDrawList: ShadowCasterDrawListPlanReport;
  readonly transforms: Float32Array;
  readonly cache?: Map<string, ShadowCasterWorldTransformBufferResource>;
  readonly bindGroupCache?: Map<string, ShadowCasterMatrixBindGroupResource>;
  readonly scratch?: ShadowCasterWorldTransformScratch;
}): ShadowCasterWorldTransforms | null {
  if (
    input.casterDrawList.status === "not-required" ||
    input.casterDrawList.includedDrawCount === 0
  ) {
    return null;
  }

  const scratch = input.scratch ?? createShadowCasterWorldTransformScratch();

  let entryCount = 0;
  for (const list of input.casterDrawList.lists) {
    entryCount += list.draws.length;
  }

  if (entryCount === 0) {
    return null;
  }

  const floatCount = entryCount * SHADOW_CASTER_MATRIX_FLOATS;

  if (scratch.data.length < floatCount) {
    scratch.data = new Float32Array(floatCount);
  }

  const data = scratch.data.subarray(0, floatCount);
  let entryIndex = 0;

  for (const list of input.casterDrawList.lists) {
    for (const draw of list.draws) {
      writeShadowCasterWorldMatrix(
        data,
        entryIndex * SHADOW_CASTER_MATRIX_FLOATS,
        input.transforms,
        draw.worldTransformOffset,
      );
      entryIndex += 1;
    }
  }

  const resourceKey = "shadow-caster-world-transform-buffer:directional";
  const cached = input.cache?.get(resourceKey);

  if (cached !== undefined) {
    if (cached.byteSize === data.byteLength) {
      if (!writeShadowCasterWorldTransformUpdates(input.device, cached, data)) {
        return null;
      }
      return { buffer: cached.buffer, resourceKey, recreated: false };
    }

    destroyWebGpuBuffer(cached.buffer);
    input.cache?.delete(resourceKey);
    invalidateShadowCasterWorldTransformBindGroups(
      input.bindGroupCache,
      resourceKey,
    );
  }

  const buffer = createWebGpuBuffer({
    device: input.device,
    descriptor: {
      label: "ShadowCasterWorldTransforms/storage",
      size: data.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: data,
    },
  });

  if (!buffer.ok) {
    return null;
  }

  input.cache?.set(resourceKey, {
    resourceKey,
    label: "ShadowCasterWorldTransforms/storage",
    buffer: buffer.buffer,
    byteSize: data.byteLength,
    matrixCount: entryCount,
    lastData: new Float32Array(data),
  });

  return { buffer: buffer.buffer, resourceKey, recreated: true };
}

function buildShadowCasterWorldTransformIndex(input: {
  readonly casterDrawList: ShadowCasterDrawListPlanReport;
  readonly scratch?: ShadowCasterWorldTransformScratch;
}): ReadonlyMap<string, number> {
  const scratch = input.scratch ?? createShadowCasterWorldTransformScratch();
  const indexByPassDraw = scratch.indexByPassDraw;
  let entryIndex = 0;

  indexByPassDraw.clear();

  for (const list of input.casterDrawList.lists) {
    for (const draw of list.draws) {
      indexByPassDraw.set(`${list.passKey}:${draw.renderId}`, entryIndex);
      entryIndex += 1;
    }
  }

  return indexByPassDraw;
}

function writeShadowCasterWorldTransformUpdates(
  device: RenderShadowFrameDeviceLike,
  cached: ShadowCasterWorldTransformBufferResource,
  data: Float32Array,
): boolean {
  const ranges: { floatOffset: number; floatCount: number }[] = [];
  let changedFloatCount = 0;
  let index = 0;

  while (index < data.length) {
    if (cached.lastData[index] === data[index]) {
      index += 1;
      continue;
    }

    const start = index;

    while (index < data.length && cached.lastData[index] !== data[index]) {
      index += 1;
    }

    const floatCount = index - start;

    changedFloatCount += floatCount;
    ranges.push({ floatOffset: start, floatCount });
  }

  if (changedFloatCount === 0) {
    return true;
  }

  const fullWrite =
    changedFloatCount / data.length >=
    SHADOW_CASTER_WORLD_DIRTY_FULL_WRITE_FRACTION;

  if (fullWrite) {
    if (!writeWebGpuBufferData(device, cached.buffer, data)) {
      return false;
    }
    cached.lastData.set(data);
    return true;
  }

  const uploadRanges = mergeShadowCasterWorldDirtyRanges(ranges);

  if (uploadRanges.length > SHADOW_CASTER_WORLD_DIRTY_MAX_RANGES) {
    if (!writeWebGpuBufferData(device, cached.buffer, data)) {
      return false;
    }
    cached.lastData.set(data);
    return true;
  }

  for (const range of uploadRanges) {
    const byteOffset = range.floatOffset * Float32Array.BYTES_PER_ELEMENT;
    const byteLength = range.floatCount * Float32Array.BYTES_PER_ELEMENT;

    if (
      !writeWebGpuBufferSubData(device, cached.buffer, data, {
        bufferOffset: byteOffset,
        dataByteOffset: byteOffset,
        byteLength,
      })
    ) {
      return false;
    }

    cached.lastData.set(
      data.subarray(range.floatOffset, range.floatOffset + range.floatCount),
      range.floatOffset,
    );
  }

  return true;
}

function mergeShadowCasterWorldDirtyRanges(
  ranges: readonly {
    readonly floatOffset: number;
    readonly floatCount: number;
  }[],
): readonly { readonly floatOffset: number; readonly floatCount: number }[] {
  if (ranges.length <= 1) {
    return ranges;
  }

  const merged: { floatOffset: number; floatCount: number }[] = [];
  let currentStart = ranges[0]?.floatOffset ?? 0;
  let currentEnd = currentStart + (ranges[0]?.floatCount ?? 0);

  for (let index = 1; index < ranges.length; index += 1) {
    const range = ranges[index];

    if (range === undefined) {
      continue;
    }

    const rangeEnd = range.floatOffset + range.floatCount;
    const gap = range.floatOffset - currentEnd;

    if (gap <= SHADOW_CASTER_WORLD_DIRTY_MERGE_GAP_FLOATS) {
      currentEnd = Math.max(currentEnd, rangeEnd);
      continue;
    }

    merged.push({
      floatOffset: currentStart,
      floatCount: currentEnd - currentStart,
    });
    currentStart = range.floatOffset;
    currentEnd = rangeEnd;
  }

  merged.push({
    floatOffset: currentStart,
    floatCount: currentEnd - currentStart,
  });

  return merged;
}

function writeShadowCasterWorldMatrix(
  output: Float32Array,
  outputOffset: number,
  transforms: Float32Array,
  sourceOffset: number,
): void {
  if (
    !Number.isInteger(sourceOffset) ||
    sourceOffset < 0 ||
    sourceOffset + SHADOW_CASTER_MATRIX_FLOATS > transforms.length
  ) {
    output.set(SHADOW_CASTER_IDENTITY, outputOffset);
    return;
  }

  output.set(
    transforms.subarray(
      sourceOffset,
      sourceOffset + SHADOW_CASTER_MATRIX_FLOATS,
    ),
    outputOffset,
  );
}

function shadowCasterPassMatrixBufferResourceKey(
  passKey: string,
  matrixKey: string,
): string {
  return `shadow-caster-pass-matrix-buffer:${encodeURIComponent(passKey)}:${encodeURIComponent(matrixKey)}`;
}

function floatArraysEqual(a: Float32Array, b: Float32Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }

  return true;
}

function invalidateShadowCasterWorldTransformBindGroups(
  cache: Map<string, ShadowCasterMatrixBindGroupResource> | undefined,
  worldTransformResourceKey: string,
): void {
  if (cache === undefined) {
    return;
  }

  for (const [key, resource] of cache) {
    if (resource.worldTransformResourceKey === worldTransformResourceKey) {
      cache.delete(key);
    }
  }
}

function invalidateShadowCasterMatrixBindGroup(
  cache: Map<string, ShadowCasterMatrixBindGroupResource> | undefined,
  matrixResourceKey: string | undefined,
): void {
  if (matrixResourceKey === undefined) {
    return;
  }

  cache?.delete(shadowCasterMatrixBindGroupResourceKey(matrixResourceKey));
}

export interface PrimaryShadowCamera {
  readonly viewMatrix: Mat4Like;
  readonly projectionMatrix: Mat4Like;
  readonly near: number;
  readonly far: number;
}

export function resolvePrimaryShadowCamera(
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
  const defaultTargetViews = snapshot.views.filter(
    (view) => view.renderTarget === null,
  );
  const candidates =
    defaultTargetViews.length === 0 ? snapshot.views : defaultTargetViews;

  if (candidates.length === 0) {
    return undefined;
  }

  const receiverLayerMask = directionalShadowReceiverLayerMask(
    snapshot.shadowRequests,
  );
  const visibleReceiverLayerMask = visibleStandardReceiverLayerMask(
    snapshot.meshDraws,
    receiverLayerMask,
  );
  const targetLayerMask =
    visibleReceiverLayerMask === 0
      ? receiverLayerMask
      : visibleReceiverLayerMask;

  if (targetLayerMask !== 0) {
    const receiverView = candidates.find(
      (view) => (view.layerMask & targetLayerMask) !== 0,
    );

    if (receiverView !== undefined) {
      return receiverView;
    }
  }

  return candidates[0];
}

function directionalShadowReceiverLayerMask(
  shadowRequests: readonly ShadowRequestPacket[],
): number {
  return shadowRequests.reduce(
    (mask, request) =>
      isDirectionalShadowRequest(request)
        ? mask | request.receiverLayerMask
        : mask,
    0,
  );
}

function visibleStandardReceiverLayerMask(
  meshDraws: RenderSnapshot["meshDraws"],
  receiverLayerMask: number,
): number {
  if (receiverLayerMask === 0) {
    return 0;
  }

  return meshDraws.reduce((mask, draw) => {
    if (
      draw.receivesShadow === false ||
      !draw.batchKey.pipelineKey.startsWith("standard|") ||
      (draw.layerMask & receiverLayerMask) === 0
    ) {
      return mask;
    }

    return mask | draw.layerMask;
  }, 0);
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

/**
 * Point shadows render the scene into a 6-layer depth array (one perspective
 * pass per cube face, stored as array layers). The receiver samples each face by
 * reprojecting through the SAME per-face matrix and computing the layer UV in
 * the shader, so placement is self-consistent and does not depend on the
 * hardware cube-map face/UV convention (which a real cube texture would). The
 * near/far planes are derived from the light range by the point view-projection
 * plan, so only resolution + bias are authored here.
 */
function createPointShadowDescriptor(
  request: ShadowRequestPacket,
  options: RenderShadowFrameShadowMapOptions | undefined,
): ShadowMapDescriptorSource {
  return {
    shadowId: request.shadowId,
    lightId: request.lightId,
    mapSize: options?.mapSize ?? request.mapSize ?? DEFAULT_SHADOW_MAP_SIZE,
    depthBias: options?.depthBias ?? request.depthBias ?? DEFAULT_DEPTH_BIAS,
    normalBias: options?.normalBias ?? request.normalBias ?? 0,
    filterRadiusTexels:
      options?.filterRadiusTexels ?? request.filterRadius ?? 1,
    cascadeCount: 1,
    faceCount: 6,
    layerCount: 6,
    layerBaseIndex: 0,
    viewDimension: "2d-array",
    resourceKey:
      options?.resourceKey ??
      `shadow-map:${request.shadowId}:light:${request.lightId}`,
  };
}

/**
 * Spot shadows render the scene into a single 2D depth map from one perspective
 * camera looking down the cone axis (three.js SpotLightShadow). This mirrors the
 * directional non-cascaded descriptor (single 2D, cascadeCount 1) so the
 * receiver reuses the directional bind-group layout; the near/far come from the
 * light range via the spot view-projection plan, so only resolution + bias are
 * authored here.
 */
function createSpotShadowDescriptor(
  request: ShadowRequestPacket,
  options: RenderShadowFrameShadowMapOptions | undefined,
): ShadowMapDescriptorSource {
  return {
    shadowId: request.shadowId,
    lightId: request.lightId,
    mapSize: options?.mapSize ?? request.mapSize ?? DEFAULT_SHADOW_MAP_SIZE,
    depthBias: options?.depthBias ?? request.depthBias ?? DEFAULT_DEPTH_BIAS,
    normalBias: options?.normalBias ?? request.normalBias ?? 0,
    filterRadiusTexels:
      options?.filterRadiusTexels ?? request.filterRadius ?? 1,
    cascadeCount: 1,
    viewDimension: "2d",
    resourceKey:
      options?.resourceKey ??
      `shadow-map:${request.shadowId}:light:${request.lightId}`,
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
  readonly kind: RenderShadowFrameKind;
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
  const diagnostics = collectRenderShadowFrameDiagnostics(
    input.stages,
    input.kind,
  );
  const submitted = input.commandBufferSubmission.status === "submitted";
  const assembledOrPlannedPasses =
    input.commandBufferSubmission.counts.assembledPasses > 0
      ? input.commandBufferSubmission.counts.assembledPasses
      : input.stages.passAttachments.passCount;
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
    passCount: assembledOrPlannedPasses,
    drawCalls: input.commandBufferSubmission.counts.drawCalls,
    descriptor: shadowMapDescriptorReportToJsonValue(input.stages.descriptor),
    viewProjection: serializeShadowViewProjection(
      input.stages.viewProjection,
      input.kind,
    ),
    matrixComputation: serializeShadowMatrixComputation(
      input.stages.matrixComputation,
      input.kind,
    ),
    casterDrawList: shadowCasterDrawListPlanReportToJsonValue(
      input.stages.casterDrawList,
    ),
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
      assembledPasses: assembledOrPlannedPasses,
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
  readonly viewProjection: RenderShadowFrameViewProjectionReport;
  readonly matrixComputation: RenderShadowFrameMatrixComputationReport;
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

/**
 * Serialize a per-kind shadow view-projection report to its JSON value. The
 * directional, point, and spot reports have different shapes, so the active kind
 * picks the matching serializer (the frame bakes a single kind — see kindLabel).
 */
function serializeShadowViewProjection(
  report: RenderShadowFrameViewProjectionReport,
  kind: RenderShadowFrameKind,
): RenderShadowFrameViewProjectionReport {
  return kind === "point"
    ? pointShadowViewProjectionPlanReportToJsonValue(
        report as PointShadowViewProjectionPlanReport,
      )
    : kind === "spot"
      ? spotShadowViewProjectionPlanReportToJsonValue(
          report as SpotShadowViewProjectionPlanReport,
        )
      : directionalShadowViewProjectionPlanReportToJsonValue(
          report as DirectionalShadowViewProjectionPlanReport,
        );
}

function serializeShadowMatrixComputation(
  report: RenderShadowFrameMatrixComputationReport,
  kind: RenderShadowFrameKind,
): RenderShadowFrameMatrixComputationReport {
  return kind === "point"
    ? pointShadowMatrixComputationReportToJsonValue(
        report as PointShadowMatrixComputationReport,
      )
    : kind === "spot"
      ? spotShadowMatrixComputationReportToJsonValue(
          report as SpotShadowMatrixComputationReport,
        )
      : directionalShadowMatrixComputationReportToJsonValue(
          report as DirectionalShadowMatrixComputationReport,
        );
}

function collectRenderShadowFrameDiagnostics(
  stages: RenderShadowFrameDiagnosticStages,
  kind: RenderShadowFrameKind,
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
    serializeShadowViewProjection(stages.viewProjection, kind).diagnostics,
  );
  append(
    "matrixComputation",
    serializeShadowMatrixComputation(stages.matrixComputation, kind)
      .diagnostics,
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

function isPointShadowRequest(request: ShadowRequestPacket): boolean {
  return request.lightKind === "point";
}

function isSpotShadowRequest(request: ShadowRequestPacket): boolean {
  return request.lightKind === "spot";
}

function shadowRequestNeedsCameraFrustumFit(
  request: ShadowRequestPacket,
): boolean {
  return (
    isDirectionalShadowRequest(request) && (request.orthographicSize ?? 0) <= 0
  );
}
